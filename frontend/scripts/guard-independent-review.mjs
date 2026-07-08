#!/usr/bin/env node
/**
 * guard:independent-review (2026-07-06 · 把铁律4「独立会审」从纸面门变提交前强制门 · grove 天才建议)。
 *
 * 病根：铁律4 要求高危改动过「独立会审 + 一条回归断言」,但一直只是 CLAUDE.md 里的规矩——
 * 靠自觉。2026-07-06 独立会审一读就抓出 6-28「自改自验」漏掉的 CRITICAL(dept 蜂群路由匿名+admin提权)
 * 和 HIGH(空蜂群冒充绿灯)。证明自验必漏盲点(grove:证据一读就现形)。本 guard 把「安全/鉴权/决策权威」
 * 这类高危路径钉成:暂存 diff 命中 → commit body 必须有一行 `会审: <谁/结论>` 证明已过独立会审,否则阻断。
 *
 * 两种用法(镜像 guard-guardian.mjs)：
 *   ① 顾问模式  `pnpm guard:independent-review`           → 列出本次命中的高危面,不读 commit msg。
 *   ② 把门模式  `node scripts/guard-independent-review.mjs <commit-msg-file>`(commit-msg 钩子)
 *               → 命中但 msg 无 `会审:` 行时,REVIEW_STRICT=1 则 exit 1 阻断,否则 warn。
 *
 * 会审痕不是签字画押:`会审:` 行应指向真跑过的独立复审(security-auditor 子 agent 读真实 diff,
 * 或 /code-review ultra),不是作者自夸。门只强制「留痕」,真跑靠人——但没痕连 commit 都过不去。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' });

/**
 * 高危面 → 命中判据。铁律4 两类(写共享主表 / 给裁决加视觉权重)+ 本会审新增的安全轴。
 * 每条 test(file) 命中即认为触达该高危面,需独立会审痕。
 */
const HIGH_RISK = [
  { label: '鉴权/会话守门', test: (f) => /^src\/lib\/auth\//.test(f) || /src\/middleware\.ts$/.test(f) },
  { label: '部门→蜂群派发(内注 admin token 打后端)', test: (f) => /dispatchDeptToSwarm|jiqun-live-swarm-adapter|dept-swarm-dispatch|dept\/.*\/route\.ts$/.test(f) },
  { label: '特权写入/后端验签代理', test: (f) => /api\/(jiqun|court\/orchestrate\/sign-off)\b/.test(f) || /backend-verify/.test(f) },
  { label: '出口人工确认门(L0-L4)', test: (f) => /features\/governance\/lib\/gate\.ts$/.test(f) },
  { label: '写共享主表 tasks(briefing/史馆/KPI 不按 id 读)', test: (f) => /primary-store|court_state_store/.test(f) },
];

const strict = process.env.REVIEW_STRICT === '1';
const msgFile = process.argv[2];

function stagedFiles() {
  try {
    const files = git(['diff', '--cached', '--name-only']).split('\n').map((s) => s.trim()).filter(Boolean);
    if (files.length) return files;
  } catch { /* 非 git 环境 */ }
  try {
    return git(['diff', '--name-only', 'HEAD']).split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

const files = stagedFiles();
const hits = HIGH_RISK.filter((h) => files.some((f) => h.test(f)));

if (hits.length === 0) {
  console.log('✅ guard:independent-review — 本次改动未命中高危面(鉴权/派发/特权写/出口门/主表),无需独立会审痕。');
  process.exit(0);
}

console.log(`🛡️ guard:independent-review — 本次改动触达 ${hits.length} 个高危面:`);
for (const h of hits) console.log(`  · ${h.label}`);

if (!msgFile) {
  console.log('\n（顾问模式。把门请走 commit-msg 钩子:commit body 加一行 `会审: <谁> — <一句结论 + 回归断言>`。）');
  console.log('   跑法:开 2 个 security-auditor 子 agent 读真实 git diff(不在你上下文里),或 /code-review ultra。');
  process.exit(0);
}

let msg = '';
try { msg = readFileSync(msgFile, 'utf8'); } catch { /* ignore */ }
const hasReviewLine = /(^|\n)\s*会审[:：]/.test(msg);

if (hasReviewLine) {
  console.log('\n✅ commit body 含 `会审:` 行,视为已留铁律4 独立会审痕。放行。');
  process.exit(0);
}

console.log(`\n${strict ? '❌' : '⚠️ '} 触达高危面但 commit body 无 \`会审:\` 行。`);
console.log('   铁律4:安全/鉴权/派发/决策权威类高危改动,提交前须过独立会审(非作者自审)+ 留一条回归断言。');
console.log('   补一行如:`会审: security-auditor 双读 diff — dept 派发已装共享守门,tripwire 回归断言已加`');
process.exit(strict ? 1 : 0);
