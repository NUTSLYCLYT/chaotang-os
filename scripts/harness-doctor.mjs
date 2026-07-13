#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const H = join(root, '.harness');

let errors = 0;
let warnings = 0;

function ok(message) {
  console.log(`[ok] ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`[warn] ${message}`);
}

function error(message) {
  errors += 1;
  console.error(`[error] ${message}`);
}

async function readText(path) {
  return readFile(path, 'utf8');
}

function checkExists(rel, label = rel) {
  const abs = join(root, rel);
  if (existsSync(abs)) ok(`required: ${label}`);
  else error(`missing required file: ${label}`);
}

const required = [
  'AGENTS.md',
  'README.md',
  'scripts/harness-doctor.mjs',
  'scripts/new-change.mjs',
  '.harness/agents/project-owner.md',
  '.harness/rules/project-boundaries.md',
  '.harness/rules/project-workflow.md',
  '.harness/wiki/architecture.md',
  '.harness/wiki/harness-inventory.md',
  '.harness/wiki/verification-matrix.md',
  '.harness/manifest/project-harness.json',
  '.harness/templates/change-template/summary.md',
  '.harness/templates/change-template/request_analysis/spec.md',
  '.harness/templates/change-template/request_analysis/tasks.md',
  '.harness/templates/change-template/ci_result/ci_summary.md',
  '.harness/changes/chore-project-harness-architecture-20260709/summary.md',
  'frontend/AGENTS.md',
  'frontend/.harness/agents/frontend-owner.md',
  'frontend/scripts/harness-doctor.mjs',
  'backend/AGENTS.md',
  'backend/harness/README.md',
  'docs/README.md',
];

for (const rel of required) checkExists(rel);

const entrypointExpectations = [
  ['AGENTS.md', '.harness/agents/project-owner.md'],
  ['README.md', '.harness/'],
  ['.harness/agents/project-owner.md', '.harness/manifest/project-harness.json'],
  ['.harness/rules/project-boundaries.md', 'backend/harness/'],
  ['.harness/wiki/harness-inventory.md', 'frontend/.harness/'],
];

for (const [rel, needle] of entrypointExpectations) {
  const abs = join(root, rel);
  if (!existsSync(abs)) continue;
  const text = await readText(abs);
  if (text.includes(needle)) ok(`entrypoint: ${rel} -> ${needle}`);
  else error(`entrypoint ${rel}: missing reference to ${needle}`);
}

const manifestFile = join(H, 'manifest', 'project-harness.json');
let manifest = null;
if (existsSync(manifestFile)) {
  try {
    manifest = JSON.parse(await readText(manifestFile));
    ok('manifest: project-harness.json');
  } catch (cause) {
    error(`manifest invalid JSON: ${cause.message}`);
  }
}

if (manifest) {
  for (const rel of manifest.root?.entrypoints ?? []) checkExists(rel, `manifest root entrypoint: ${rel}`);
  for (const rel of manifest.frontend?.entrypoints ?? []) checkExists(rel, `manifest frontend entrypoint: ${rel}`);
  for (const rel of manifest.backend?.entrypoints ?? []) checkExists(rel, `manifest backend entrypoint: ${rel}`);
  for (const rel of manifest.docs?.entrypoints ?? []) checkExists(rel, `manifest docs entrypoint: ${rel}`);

  if (manifest.controlPlane) {
    for (const key of ['blueprint', 'documentation', 'baseline']) {
      if (manifest.controlPlane[key]) checkExists(manifest.controlPlane[key], `manifest control plane ${key}`);
      else error(`manifest control plane missing ${key}`);
    }
    for (const rel of manifest.controlPlane.contracts ?? []) checkExists(rel, `manifest control plane contract: ${rel}`);
    if (!['DESIGNED', 'IMPLEMENTING', 'IMPLEMENTED', 'ROLLOUT', 'ENFORCED'].includes(manifest.controlPlane.status)) {
      error(`manifest control plane has invalid status: ${manifest.controlPlane.status}`);
    }
    const componentStates = Object.values(manifest.controlPlane.components ?? {});
    if (manifest.controlPlane.status === 'ENFORCED' && componentStates.some((state) => state !== 'ENFORCED')) {
      error('manifest control plane cannot be ENFORCED while a component is not ENFORCED');
    }

    const rolloutHistoryFile = join(H, 'rollout-history.jsonl');
    if (!existsSync(rolloutHistoryFile)) {
      error('missing .harness/rollout-history.jsonl (required to track rolloutStage/components changes)');
    } else {
      const rawText = await readText(rolloutHistoryFile);
      const lines = rawText.trim().split('\n').filter(Boolean);
      const last = lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : null;
      if (!last) {
        error('.harness/rollout-history.jsonl is empty; append an entry for the current rolloutStage/components');
      } else {
        const requiredFields = ['date', 'actor', 'reason'];
        const missingFields = requiredFields.filter((key) => typeof last[key] !== 'string' || last[key].trim() === '');
        if (!('relatedIncident' in last)) missingFields.push('relatedIncident');
        if (missingFields.length > 0) {
          error(`.harness/rollout-history.jsonl last entry missing required audit field(s): ${missingFields.join(', ')}`);
        } else if (
          last.rolloutStage !== manifest.controlPlane.rolloutStage ||
          JSON.stringify(last.components) !== JSON.stringify(manifest.controlPlane.components)
        ) {
          error(
            'manifest controlPlane.rolloutStage/components changed but .harness/rollout-history.jsonl has no matching last entry; append {date, actor, rolloutStage, components, reason, relatedIncident}',
          );
        } else {
          ok('rollout-history.jsonl matches current controlPlane state with required audit fields');
        }
      }

      // 只比对最新一行没法防"改到B又偷偷改回A、中间那次B从没写进日志"——B和A各自
      // 落盘那一刻都必须先过 doctor，所以历史必须只能追加、不能改写已提交的行；
      // 这样A→B→A两次真实落盘都各自留痕，不会被"最终状态没变"掩盖。
      const committed = spawnSync('git', ['show', 'HEAD:.harness/rollout-history.jsonl'], {
        cwd: root,
        encoding: 'utf8',
      });
      if (committed.status === 0) {
        const committedLines = committed.stdout.trim().split('\n').filter(Boolean);
        const isPrefix = committedLines.every((line, index) => lines[index] === line);
        if (!isPrefix) {
          error('.harness/rollout-history.jsonl rewrote or removed a previously committed entry; history must be append-only');
        } else {
          ok('rollout-history.jsonl is append-only relative to HEAD');
        }
      }

      // append-only 挡不住"同一次改动里把检查代码本身也改弱/删掉"——checker和被
      // 检查的状态住在同一个仓库，任何本地脚本检查天然防不住这种自我修改。这里
      // 不假装能防住，只在检测到两者同批改动时强制要求显式承认，把"悄悄绕过"
      // 变成"写进永久记录里的公开承认"，成本从0提到"要在审计日志里承认"。
      const doctorScriptPath = fileURLToPath(import.meta.url);
      const doctorDiskText = await readFile(doctorScriptPath, 'utf8');
      const doctorCommitted = spawnSync('git', ['show', 'HEAD:scripts/harness-doctor.mjs'], {
        cwd: root,
        encoding: 'utf8',
      });
      const manifestCommitted = spawnSync('git', ['show', 'HEAD:.harness/manifest/project-harness.json'], {
        cwd: root,
        encoding: 'utf8',
      });
      if (doctorCommitted.status === 0 && manifestCommitted.status === 0 && last) {
        const checkerChanged = doctorCommitted.stdout !== doctorDiskText;
        let manifestControlPlaneChanged = false;
        try {
          const prevManifest = JSON.parse(manifestCommitted.stdout);
          manifestControlPlaneChanged =
            prevManifest.controlPlane?.rolloutStage !== manifest.controlPlane.rolloutStage ||
            JSON.stringify(prevManifest.controlPlane?.components) !== JSON.stringify(manifest.controlPlane.components);
        } catch {
          manifestControlPlaneChanged = true;
        }
        if (checkerChanged && manifestControlPlaneChanged && last.checkerChangedInThisTransition !== true) {
          error(
            'scripts/harness-doctor.mjs and controlPlane rolloutStage/components changed in the same revision; set checkerChangedInThisTransition:true in the rollout-history.jsonl entry and explain why in reason',
          );
        } else if (checkerChanged && manifestControlPlaneChanged) {
          ok('rollout gate change disclosed via checkerChangedInThisTransition');
        }
      }
    }
  }

  if (manifest.frontend?.harness) checkExists(manifest.frontend.harness, 'manifest frontend harness');
  if (manifest.frontend?.doctor) checkExists(manifest.frontend.doctor, 'manifest frontend doctor');
  if (manifest.backend?.harnessRoot) checkExists(manifest.backend.harnessRoot, 'manifest backend harness root');
  if (manifest.backend?.harnessManifest) checkExists(manifest.backend.harnessManifest, 'manifest backend harness manifest');
  if (manifest.backend?.doctor) checkExists(manifest.backend.doctor, 'manifest backend doctor');

  for (const name of manifest.backend?.primaryHarnesses ?? []) {
    const dir = join(root, manifest.backend.harnessRoot, name);
    const readme = join(dir, 'README.md');
    if (!existsSync(dir)) {
      error(`backend primary harness missing: ${name}`);
    } else if (!existsSync(readme)) {
      error(`backend primary harness missing README.md: ${name}`);
    } else {
      ok(`backend primary harness: ${name}`);
    }
  }

  for (const name of manifest.backend?.implementationPackages ?? []) {
    const dir = join(root, manifest.backend.harnessRoot, name);
    if (existsSync(dir)) ok(`backend implementation package: ${name}`);
    else error(`backend implementation package missing: ${name}`);
  }

  for (const artifact of manifest.backend?.referenceArtifacts ?? []) {
    const base = join(root, artifact.path);
    if (!existsSync(base)) {
      error(`backend referenceArtifact ${artifact.id}: directory missing: ${artifact.path}`);
      continue;
    }
    for (const rel of artifact.required ?? []) {
      const abs = join(base, rel);
      if (existsSync(abs)) ok(`referenceArtifact ${artifact.id}/${rel}`);
      else error(`referenceArtifact ${artifact.id}: missing required file: ${rel}`);
    }
    ok(`backend referenceArtifact: ${artifact.id}`);
  }

  const harnessRoot = join(root, manifest.backend?.harnessRoot ?? 'backend/harness');
  if (existsSync(harnessRoot)) {
    const entries = await readdir(harnessRoot, { withFileTypes: true });
    const known = new Set([
      ...(manifest.backend?.primaryHarnesses ?? []),
      ...(manifest.backend?.implementationPackages ?? []),
      ...(manifest.backend?.allowedInfrastructureDirs ?? []),
    ]);
    for (const entry of entries.filter((item) => item.isDirectory())) {
      if (!known.has(entry.name)) warn(`backend harness directory not represented in manifest: ${entry.name}`);
    }
  }
}

const rootChangeRoot = join(H, 'changes');
if (existsSync(rootChangeRoot)) {
  const entries = await readdir(rootChangeRoot, { withFileTypes: true });
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const summary = join(rootChangeRoot, entry.name, 'summary.md');
    if (!existsSync(summary)) {
      error(`root change ${entry.name}: missing summary.md`);
      continue;
    }

    const text = await readText(summary);
    if (!text.includes(`| Change ID | ${entry.name} |`)) {
      error(`root change ${entry.name}: summary Change ID mismatch`);
    }

    const isDelivered = /\|\s*Status\s*\|\s*DELIVERED\s*\|/i.test(text);
    if (isDelivered) {
      const requiredRootChangeFiles = [
        'summary.md',
        'request_analysis/spec.md',
        'request_analysis/tasks.md',
        'ci_result/ci_summary.md',
      ];
      for (const rel of requiredRootChangeFiles) {
        if (!existsSync(join(rootChangeRoot, entry.name, rel))) {
          error(`root change ${entry.name}: DELIVERED missing ${rel}`);
        }
      }

      const hits = [];
      async function scan(dir) {
        const items = await readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const path = join(dir, item.name);
          if (item.isDirectory()) {
            await scan(path);
            continue;
          }
          if (!item.name.endsWith('.md')) continue;
          const body = await readText(path);
          if (/\bTBD\b|\bPENDING\b|\{\{[A-Z_]+\}\}/.test(body)) hits.push(path);
        }
      }
      await scan(join(rootChangeRoot, entry.name));
      if (hits.length > 0) {
        error(
          `root change ${entry.name}: DELIVERED but contains placeholders: ${hits
            .map((path) => path.replace(root, '').replace(/^[/\\]/, ''))
            .join(', ')}`,
        );
      }
    }

    ok(`root change: ${entry.name}`);
  }
}

const frontendDoctor = spawnSync(process.execPath, ['scripts/harness-doctor.mjs'], {
  cwd: join(root, 'frontend'),
  encoding: 'utf8',
});
if (frontendDoctor.status === 0) {
  ok('delegated frontend harness doctor');
} else {
  error('delegated frontend harness doctor failed');
  if (frontendDoctor.stdout) console.log(frontendDoctor.stdout.trim());
  if (frontendDoctor.stderr) console.error(frontendDoctor.stderr.trim());
}

if (manifest?.backend?.doctor) {
  // 有的环境只装了 python3，没有 python 这个别名（本仓文档/其他机器上假设两者
  // 等价，但不是所有环境都这样配置）——先按文档约定试 python，ENOENT 时(命令
  // 压根不存在，不是脚本本身报错)退回 python3，两边都试不到才算真失败。
  let backendDoctor = spawnSync('python', ['scripts/harness_doctor.py'], {
    cwd: join(root, 'backend'),
    encoding: 'utf8',
  });
  if (backendDoctor.error?.code === 'ENOENT') {
    backendDoctor = spawnSync('python3', ['scripts/harness_doctor.py'], {
      cwd: join(root, 'backend'),
      encoding: 'utf8',
    });
  }
  if (backendDoctor.status === 0) {
    ok('delegated backend harness doctor');
  } else {
    error('delegated backend harness doctor failed');
    if (backendDoctor.stdout) console.log(backendDoctor.stdout.trim());
    if (backendDoctor.stderr) console.error(backendDoctor.stderr.trim());
  }
}

console.log('');
if (errors > 0) {
  console.error(`project-harness-doctor: ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}

console.log(`project-harness-doctor: 0 errors, ${warnings} warning(s)`);
