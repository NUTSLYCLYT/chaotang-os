#!/usr/bin/env node

/**
 * 修复胶囊 artifact 摘要失配（capsule content digest drift）。
 *
 * 背景：提交 c278a4a9f 改了 capsules 的 objects/evaluations.json 内容，
 * 但未同步更新 capsule.json 的 artifacts.evaluations.digest，
 * 导致 capability_capsule.test.mjs 报 artifact_digest_mismatch。
 *
 * 本脚本**只做一件事**：用官方 canonicalDigest() 按磁盘实际内容重算
 * artifacts[*].digest 与 content_digests（两者必须一致），
 * 然后用官方 buildCapabilityLockfile() 重建 capsule.lock.json。
 *
 * 严格约束：
 *   - 不修改任何 objects/ 下的内容文件（只读）
 *   - 不手写哈希，全部走官方函数
 *   - 幂等：已是正确状态时输出 no-op
 *   - 提供 --dry-run 预览
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCapabilityLockfile,
  canonicalDigest,
  resolveTrustedAuthority,
} from "./capability_capsule.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const CANDIDATES = join(ROOT, "backend", "harness", "capability_candidates");
const MANIFEST_PATH = join(CANDIDATES, "authority-manifest.json");

// 与 capability_capsule.mjs 的 ARTIFACTS 保持一致
const CONTENT_ARTIFACTS = [
  "prompt",
  "contract",
  "policy",
  "behavior",
  "adapter",
  "evaluations",
  "telemetry",
  "rollback",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** 收集所有胶囊目录（顶层 + candidates/ 下） */
function locateCapsuleDirs(root) {
  const dirs = [];
  const top = join(root, "rites-message-quality-gate");
  if (existsSync(join(top, "capsule.json"))) dirs.push(top);
  const candidatesRoot = join(root, "candidates");
  if (existsSync(candidatesRoot)) {
    for (const entry of readdirSync(candidatesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(candidatesRoot, entry.name);
      if (existsSync(join(dir, "capsule.json"))) dirs.push(dir);
    }
  }
  return dirs.sort();
}

/** 重算单个胶囊的摘要；返回变更描述列表 */
function repairCapsule(capsuleDir, manifest, { dryRun }) {
  const capsulePath = join(capsuleDir, "capsule.json");
  const lockPath = join(capsuleDir, "capsule.lock.json");
  const capsule = readJson(capsulePath);
  const changes = [];

  // 1. 逐内容文件重算 artifacts[*].digest（磁盘为准）
  for (const name of CONTENT_ARTIFACTS) {
    const artifact = capsule.artifacts?.[name];
    if (!artifact?.path) continue;
    const objectPath = join(capsuleDir, artifact.path);
    if (!existsSync(objectPath)) {
      changes.push(`${name}: MISSING ${artifact.path}`);
      continue;
    }
    const actual = canonicalDigest(readFileSync(objectPath));
    if (artifact.digest !== actual) {
      changes.push(`${name}: ${artifact.digest} -> ${actual}`);
      artifact.digest = actual;
    }
  }

  // 2. content_digests 只允许 4 个键，且必须与 artifacts 精确绑定
  //    （见 capability_capsule.mjs:124-125 content_digest_binding_mismatch）
  const BINDINGS = [["prompt", "prompt"], ["contract", "contract"], ["policy", "policy"], ["evaluation", "evaluations"]];
  if (capsule.content_digests) {
    for (const [digestName, artifactName] of BINDINGS) {
      const bound = capsule.artifacts?.[artifactName]?.digest;
      if (bound !== undefined && capsule.content_digests[digestName] !== bound) {
        changes.push(`content_digests.${digestName}: ${capsule.content_digests[digestName]} -> ${bound}`);
        capsule.content_digests[digestName] = bound;
      }
    }
  }

  if (changes.length === 0) {
    return { capsuleDir, changes, lockRebuilt: false, capsule: null, lock: null };
  }

  // 2. 用官方 API 重建 lockfile
  const { authority, errors } = resolveTrustedAuthority(manifest, capsule.capability_id);
  if (errors.length > 0) {
    throw new Error(`authority_unresolved:${capsule.capability_id}:${errors.join(",")}`);
  }
  const lock = buildCapabilityLockfile(capsule, { root: capsuleDir, trustedAuthority: authority });

  if (!dryRun) {
    writeFileSync(capsulePath, `${JSON.stringify(capsule, null, 2)}\n`, "utf8");
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  }
  return { capsuleDir, changes, lockRebuilt: true, capsule, lock };
}

export function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const manifest = readJson(MANIFEST_PATH);
  const dirs = locateCapsuleDirs(CANDIDATES);
  let repaired = 0;

  console.log(`${dryRun ? "[DRY-RUN] " : ""}扫描 ${dirs.length} 个胶囊目录\n`);
  for (const dir of dirs) {
    const rel = dir.slice(ROOT.length + 1);
    try {
      const result = repairCapsule(dir, manifest, { dryRun });
      if (result.changes.length === 0) {
        console.log(`  OK    ${rel}`);
      } else {
        repaired += 1;
        console.log(`  FIX   ${rel}`);
        for (const change of result.changes) console.log(`          ${change}`);
      }
    } catch (error) {
      console.log(`  ERROR ${rel}: ${error.message}`);
      return 1;
    }
  }
  console.log(`\n${dryRun ? "待修复" : "已修复"} ${repaired} 个胶囊`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
