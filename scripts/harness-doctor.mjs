#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  EXPECTED_EXECUTION_AUTHORITY_REGISTRATION,
  loadExecutionAuthority,
  resolveExecutionAuthority,
  validateExecutionAuthority,
} from './lib/execution-authority.mjs';
import { validateRepositoryStructure } from './lib/repository-structure.mjs';

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
  'scripts/execution-authority.mjs',
  'scripts/execution-authority.nodetest.mjs',
  'scripts/lib/execution-authority.mjs',
  'scripts/r0-amendment-check.mjs',
  'scripts/r0-amendment-check.nodetest.mjs',
  'scripts/lib/r0-amendment-check.mjs',
  '.harness/agents/project-owner.md',
  '.harness/rules/project-boundaries.md',
  '.harness/rules/project-workflow.md',
  '.harness/wiki/architecture.md',
  '.harness/wiki/harness-inventory.md',
  '.harness/wiki/execution-authority.md',
  '.harness/wiki/courtos-brain-extraction.md',
  '.harness/wiki/capability-entry-governance.md',
  '.harness/wiki/verification-matrix.md',
  '.harness/manifest/project-harness.json',
  '.harness/manifest/execution-authority.v1.json',
  '.harness/contracts/execution-authority.schema.json',
  '.harness/manifest/capability-entry-inventory.json',
  '.harness/contracts/capability-entry.schema.json',
  '.harness/contracts/capability-entry-event.schema.json',
  '.harness/contracts/knowledge-quality-rubric.schema.json',
  '.harness/manifest/knowledge-quality-rubric.v1.json',
  'scripts/knowledge-quality-rubric.mjs',
  'scripts/knowledge-quality-rubric.nodetest.mjs',
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

const trackedFilesResult = spawnSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
});
if (trackedFilesResult.status !== 0) {
  error(`unable to inspect tracked repository structure: ${trackedFilesResult.stderr.trim()}`);
} else {
  const trackedFiles = trackedFilesResult.stdout.split('\0').filter(Boolean);
  const structureErrors = validateRepositoryStructure(trackedFiles);
  if (structureErrors.length === 0) ok('repository structure follows the canonical ownership policy');
  else for (const message of structureErrors) error(message);
}

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

  if (manifest.executionAuthority) {
    if (
      JSON.stringify(manifest.executionAuthority) !==
      JSON.stringify(EXPECTED_EXECUTION_AUTHORITY_REGISTRATION)
    ) {
      error('manifest executionAuthority registration differs from the fixed inactive guard');
    }
    for (const key of ['manifest', 'schema', 'resolver', 'command', 'test', 'documentation']) {
      checkExists(
        EXPECTED_EXECUTION_AUTHORITY_REGISTRATION[key],
        `manifest execution authority ${key}`,
      );
    }
    const loadedAuthority = await loadExecutionAuthority(root);
    const authorityErrors = validateExecutionAuthority(loadedAuthority);
    if (authorityErrors.length > 0) {
      for (const message of authorityErrors) error(`execution authority: ${message}`);
    } else {
      const decision = resolveExecutionAuthority(loadedAuthority.manifest);
      if (decision.canExecuteCanonicalPlan !== false || decision.decision !== 'STOP') {
        error('execution-authority.v1 must remain an inactive STOP guard');
      } else {
        ok('execution authority inventories one inactive M0-M10 route and fails closed');
      }
    }
  } else {
    error('manifest missing executionAuthority');
  }

  if (manifest.amendmentGovernance) {
    const amendment = manifest.amendmentGovernance;
    for (const key of ['document', 'checker', 'test']) {
      checkExists(amendment[key], `manifest amendment governance ${key}`);
    }
    if (amendment.status !== 'PROPOSED_NOT_AUTHORITY') {
      error(`amendment governance has invalid status: ${amendment.status}`);
    }
    if (amendment.canAuthorizeRuntime !== false) {
      error('amendment governance checker must never authorize runtime');
    }
    if (!/^[0-9a-f]{64}$/.test(amendment.candidateSourceDigest ?? '')) {
      error('amendment governance candidateSourceDigest must be a sha256 hex digest');
    }
    if (amendment.approvedSourceDigest !== null) {
      error('proposed amendment must not carry an approvedSourceDigest');
    }
    for (const command of [
      'node --test scripts/r0-amendment-check.nodetest.mjs',
      'node scripts/r0-amendment-check.mjs',
      'node scripts/harness-doctor.mjs',
    ]) {
      if (!(amendment.verification ?? []).includes(command)) {
        error(`amendment governance missing verification command: ${command}`);
      }
    }
  } else {
    error('manifest missing amendmentGovernance');
  }

  if (manifest.capabilityEntryGovernance) {
    const governance = manifest.capabilityEntryGovernance;
    checkExists(governance.documentation, 'manifest capability entry governance documentation');
    checkExists(governance.inventory, 'manifest capability entry governance inventory');
    for (const rel of governance.contracts ?? []) checkExists(rel, `manifest capability entry governance contract: ${rel}`);
    if (governance.status !== 'OBSERVE') error(`capability entry governance has invalid status: ${governance.status}`);
    if (governance.telemetry?.eventName !== 'capability_entry_invoked.v1') error('capability entry governance must use capability_entry_invoked.v1');
    if (governance.deletionGate?.minimumObservationDays !== 14) error('capability entry deletion gate must observe 14 days');
    if (governance.deletionGate?.maximumInvocations !== 0) error('capability entry deletion gate must require zero invocations');
    if (governance.deletionGate?.requireVerifiedReplacement !== true) error('capability entry deletion gate must require a verified replacement');
  } else {
    error('manifest missing capabilityEntryGovernance');
  }

  if (manifest.knowledgeQualityRubric) {
    const rubric = manifest.knowledgeQualityRubric;
    checkExists(rubric.rubric, 'manifest knowledge quality rubric');
    checkExists(rubric.contract, 'manifest knowledge quality rubric contract');
    checkExists(rubric.evaluator, 'manifest knowledge quality rubric evaluator');
    if (rubric.status !== 'FROZEN_LOCAL') error(`knowledge quality rubric has invalid status: ${rubric.status}`);
    if (rubric.currentEvidenceStatus !== 'NO_DATA') {
      error('knowledge quality rubric evidence must remain NO_DATA until real golden/outcome artifacts exist');
    }
  } else {
    error('manifest missing knowledgeQualityRubric');
  }

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

      // 只比"磁盘 vs HEAD"，一旦这次改动被 commit，磁盘就等于新HEAD，下次(尤其
      // CI在干净checkout上跑，磁盘天生就等于HEAD)这两个检查永远查不出任何东西——
      // 等于commit一落地,检查就失效。所以每项都要再补一次"HEAD vs HEAD~1"，把
      // 刚落地的那一次改动本身也纳入检查,不管是交互式commit前还是CI在commit后跑。
      const showAt = (ref, relPath) => {
        const result = spawnSync('git', ['show', `${ref}:${relPath}`], { cwd: root, encoding: 'utf8' });
        return result.status === 0 ? result.stdout : null;
      };

      function checkAppendOnly(oldText, newText, label) {
        if (oldText === null) return;
        const oldLines = oldText.trim().split('\n').filter(Boolean);
        const newLines = newText.trim().split('\n').filter(Boolean);
        const isPrefix = oldLines.every((line, index) => newLines[index] === line);
        if (!isPrefix) error(`.harness/rollout-history.jsonl rewrote or removed a previously committed entry (${label}); history must be append-only`);
        else ok(`rollout-history.jsonl is append-only (${label})`);
      }

      checkAppendOnly(showAt('HEAD', '.harness/rollout-history.jsonl'), rawText, 'disk vs HEAD');
      const headHistory = showAt('HEAD', '.harness/rollout-history.jsonl');
      const parentHistory = showAt('HEAD~1', '.harness/rollout-history.jsonl');
      if (headHistory !== null) checkAppendOnly(parentHistory, headHistory, 'HEAD vs HEAD~1');

      // 曾经在这里加过一个"checker和被检查状态同一commit变化就要求显式承认"的
      // 检查，删掉了：它按"harness-doctor.mjs的原始文本有没有变"判断，任何跟绕过
      // 完全无关的改动(改错误提示文案、加注释)撞上同批次的合法rolloutStage变更
      // 都会被拦下来，而真正删检测函数的人只要顺手把承认字段设成true(或者分两次
      // commit做)就能让它一路绿灯——一边挡不该挡的，一边放不该放的，比不加还差。
      // 见 .harness/wiki/multi-agent-control-plane.md 和 .harness/policy/review-
      // required-paths.md：这类同仓自检的天花板就是挡不住"检测代码本身被删"，
      // 没有更多本地代码能修，只能靠仓库设置层面的外部强制复核。
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

const courtosBrainRoot = join(root, 'courtos-brain');
if (existsSync(courtosBrainRoot)) {
  // courtos-brain/ is an archived personal knowledge vault, not a 4th harness line
  // (see .harness/rules/project-boundaries.md). It must present zero executable
  // agent/skill entrypoints. AGENTS.md/CLAUDE.md discovery is filename-triggered by
  // convention — compliant tooling reads any file with that exact name as directory
  // instructions regardless of what's inside, so no frontmatter shape can make one
  // "safe". The check is therefore an unconditional exact-case filename/dirname ban,
  // no content inspection: real reserved names are always exact-case (AGENTS.md,
  // CLAUDE.md, SKILL.md), so this does not flag the vault's own lowercase content
  // notes (agents.md, claude.md) that happen to share a basename by coincidence.
  const forbiddenDirNames = new Set(['.agents', 'agents', 'skills', 'commands', '.claude']);
  const governanceFilenames = new Set(['AGENTS.md', 'CLAUDE.md', 'SKILL.md']);

  async function scanCourtosBrainBoundary(dir) {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const itemPath = join(dir, item.name);
      const rel = itemPath.replace(root, '').replace(/^[/\\]/, '');
      // Dirent reflects the link itself (DT_LNK), not its target: isDirectory()
      // is false even for a symlink pointing at a directory, so a symlink named
      // "agents"/"skills"/etc. would silently skip both the forbidden-dirname
      // check below and recursion into it — the exact bypass this branch closes.
      // A content-only archive has no legitimate need for symlinks, so instead of
      // resolving targets (which reopens cycle/escape-outside-root risk), any
      // symlink under courtos-brain/ is unconditionally a violation.
      if (item.isSymbolicLink()) {
        error(`courtos-brain boundary: symlink found (forbidden — could point at a live agent/skill tree): ${rel}`);
        continue;
      }
      if (item.isDirectory()) {
        // No .git exemption: courtos-brain/ is a plain subtree merge, not a nested
        // git repo, so a .git directory has no legitimate reason to exist here at
        // all. Exempting it by name would recreate the same class of blind spot
        // just closed for _wiki/ and symlinks — anything dropped inside an
        // unscanned .git/ (hooks, a smuggled nested repo, a symlink) would sit
        // outside the scan. If .git ever does appear, it gets scanned like any
        // other directory instead of being silently skipped.
        if (forbiddenDirNames.has(item.name)) {
          error(`courtos-brain boundary: forbidden agent-discovery directory: ${rel}`);
          continue;
        }
        await scanCourtosBrainBoundary(itemPath);
        continue;
      }
      if (governanceFilenames.has(item.name)) {
        error(
          `courtos-brain boundary: reserved governance filename found: ${rel} — agent tooling reads AGENTS.md/CLAUDE.md/SKILL.md by exact filename regardless of content, so no frontmatter can make this inert; rename it`,
        );
      }
    }
  }

  await scanCourtosBrainBoundary(courtosBrainRoot);
  ok('courtos-brain boundary scan complete');
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
