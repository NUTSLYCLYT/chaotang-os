#!/usr/bin/env node
// check-worktrees.mjs — worktree 治理门禁（2026-10-07 owner 拍板，规则见 docs/worktree-governance.md）
// 用法:
//   node scripts/check-worktrees.mjs          # 人类可读报告；越界 worktree 时 exit 1
//   node scripts/check-worktrees.mjs --json   # 机器可读输出
// 跨平台: 白名单默认 Windows 盘符形式；WSL/Linux 的 /mnt/<盘>/ 自动归一为 <盘>:/，
//         亦可用 CHAOTANG_WORKTREE_WHITELIST 覆盖（冒号分隔）。策略见 docs/platform-strategy.md。
// 规则:除主仓自身外,所有 worktree 必须位于白名单目录;C 盘(含 Temp/AppData)绝对禁止。
// 实现:优先走 `git worktree list --porcelain`;spawn 不可用时(受限沙箱)回退到直读
//       .git/worktrees/*/gitdir + HEAD 的文件系统通道,保证任何环境可运行。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// 白名单：默认 Windows 盘符形式；WSL/Linux 下 /mnt/<盘>/ 会自动归一为 <盘>:/（见 normPath）。
// 可通过环境变量覆盖（冒号分隔，避免平台差异），例如：
//   CHAOTANG_WORKTREE_WHITELIST="h:/chaotangworktrees/:h:/chaotangstaging/:d:/orcaworkspaces/"
const DEFAULT_WHITELIST_PREFIXES = [
  "h:/chaotangworktrees/",
  "h:/chaotangstaging/",
  "h:/chaotangsource/",
  "d:/orcaworkspaces/",
];

const WHITELIST_PREFIXES = (process.env.CHAOTANG_WORKTREE_WHITELIST
  ? process.env.CHAOTANG_WORKTREE_WHITELIST.split(":").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_WHITELIST_PREFIXES
).map((p) => (p.endsWith("/") ? p : p + "/"));

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonMode = process.argv.includes("--json");

function toFwd(p) {
  return p.replace(/\\/g, "/");
}

// WSL/Linux 的 /mnt/h/... 与 Windows 的 h:/... 视为同一目录，保证双平台结论一致。
function normPath(p) {
  return toFwd(p)
    .replace(/^\/mnt\/([a-z])\//i, (_m, drive) => drive.toLowerCase() + ":/")
    .replace(/^([a-z]):\//i, (_m, drive) => drive.toLowerCase() + ":/");
}

function collectViaGitCli() {
  const porcelain = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const entries = [];
  let current = null;
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice("worktree ".length).trim(), branch: null, detached: false };
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).trim();
    } else if (line.startsWith("detached")) {
      current.detached = true;
    }
  }
  if (current) entries.push(current);
  return entries;
}

function readHead(headPath) {
  try {
    const head = fs.readFileSync(headPath, "utf8").trim();
    if (head.startsWith("ref: refs/heads/")) return { branch: head.slice("ref: refs/heads/".length), detached: false };
    return { branch: null, detached: true };
  } catch {
    return { branch: null, detached: false };
  }
}

function collectViaFilesystem() {
  const entries = [];
  // 主 worktree
  const mainHead = readHead(path.join(repoRoot, ".git", "HEAD"));
  entries.push({ path: repoRoot, branch: mainHead.branch, detached: mainHead.detached, main: true });
  // 链接 worktree:.git/worktrees/<id>/gitdir 指向 <worktree>/.git 文件
  const wtDir = path.join(repoRoot, ".git", "worktrees");
  let ids = [];
  try {
    ids = fs.readdirSync(wtDir).filter((id) => {
      try { return fs.statSync(path.join(wtDir, id)).isDirectory(); } catch { return false; }
    });
  } catch {
    return entries;
  }
  for (const id of ids) {
    try {
      const gitdirFile = fs.readFileSync(path.join(wtDir, id, "gitdir"), "utf8").trim();
      const worktreePath = path.dirname(gitdirFile); // <worktree>/.git → <worktree>
      const head = readHead(path.join(wtDir, id, "HEAD"));
      entries.push({ path: worktreePath, branch: head.branch, detached: head.detached, main: false });
    } catch {
      // 残缺注册项:报告为未知路径,由 prune 处置
      entries.push({ path: path.join(wtDir, id), branch: null, detached: true, main: false, broken: true });
    }
  }
  return entries;
}

function mainIsGitDir() {
  try { return fs.statSync(path.join(repoRoot, ".git")).isDirectory(); } catch { return false; }
}

let entries;
let mode;
try {
  entries = collectViaGitCli();
  mode = "git-cli";
} catch {
  if (!mainIsGitDir()) {
    console.error("check-worktrees: 既无法运行 git,也无法识别 .git 目录,中止。");
    process.exit(2);
  }
  entries = collectViaFilesystem();
  mode = "filesystem";
}

const mainNorm = normPath(repoRoot).toLowerCase().replace(/\/+$/, "");
const whitelist = WHITELIST_PREFIXES.map((p) => p.toLowerCase());

const violations = [];
const report = entries.map((e) => {
  const p = normPath(e.path).replace(/\/+$/, "");
  const isMain = e.main === true || p.toLowerCase() === mainNorm;
  const allowed = isMain || whitelist.some((prefix) => p.toLowerCase().startsWith(prefix));
  if (!allowed) violations.push(e);
  return {
    path: p,
    branch: e.branch || null,
    detached: e.detached,
    main: isMain,
    allowed,
    broken: e.broken || false,
  };
});

if (jsonMode) {
  console.log(JSON.stringify({ ok: violations.length === 0, mode, total: report.length, violations, report }, null, 2));
} else {
  console.log(`worktree 总数: ${report.length}  (通道: ${mode})`);
  for (const r of report) {
    const tag = r.broken ? "[残缺!]" : r.main ? "[主仓]" : r.allowed ? "[OK]" : "[越界!]";
    const ref = r.branch || (r.detached ? "detached" : "unknown");
    console.log(`${tag} ${r.path}  (${ref})`);
  }
  if (violations.length) {
    console.error(`\n发现 ${violations.length} 个越界 worktree(不在白名单目录):`);
    for (const v of violations) console.error(`  - ${v.path}`);
    console.error("白名单: " + WHITELIST_PREFIXES.join(" | "));
    console.error("处置: git worktree remove <路径> (脏 worktree 先按 AGENTS.md 抢救规则备份)");
  } else {
    console.log("全部 worktree 均在白名单目录内。");
  }
}

process.exit(violations.length === 0 ? 0 : 1);
