#!/usr/bin/env node
/**
 * guard:guardian (2026-06-27 · 把 AGENTS.md §12.1「司·守护大神」纸面门变 CI/钩子)。
 *
 * 病根：§12.1 的守护大神表是「靠自觉遵守的纸面门」——和主线 warn-only 出口门同病(负风险)。
 * 本 guard 把它钉成可读事实：暂存改动命中某司的运行态/contract 路径时，认领该司的守护大神，
 * 并(在 commit-msg 模式下)要求 commit body 有一行 `守护: <大神>` 证明已过铁律4 独立会审。
 *
 * 两种用法：
 *   ① 顾问模式  `pnpm guard:guardian`            → 列出本次暂存改动该唤哪些守护大神(不读 commit msg)。
 *   ② 把门模式  `node scripts/guard-guardian.mjs <commit-msg-file>`(commit-msg 钩子)
 *               → 命中司但 msg 无对应 `守护:` 行时，GUARDIAN_STRICT=1 则 exit 1 阻断，否则 warn。
 *
 * 默认 warn-only(exit 0)，与 guard:upstreams/realdata/honesty 同招。把门变真：
 *   .git/hooks/commit-msg 里 `GUARDIAN_STRICT=1 node scripts/guard-guardian.mjs "$1" || exit 1`
 *
 * 接口纪律(AGENTS.md §12.1)：守护只在「审查」，不在「执行」。本 guard 只检查 dev 态会审留痕，
 * 不碰运行态(谁做活按铁律9，在 jiqun 后端)。严禁据此改 agent.ts Tier0 锁。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' });

/** 司码 → { 守护大神, 梯队 }。镜像 AGENTS.md §12.1，是该表的可执行副本。 */
const GUARDIANS = {
  // 第一梯队·已真 agent(户/刑/工)——STRICT 模式下必须留会审痕
  hu_bu:   { tier: 1, guardians: ['户部·马克斯', '大司徒·贝索斯'] },
  xing_bu: { tier: 1, guardians: ['司天监·Schneier', '太史令·塔勒布'] },
  gong_bu: { tier: 1, guardians: ['工部·Karpathy', '将作大匠·马斯克'] },
  // 第二梯队·骨架司——standby，仅提示(守铁律5，真转前不强制)
  prime_minister: { tier: 2, guardians: ['丞相·诸葛亮'] },
  scribe:         { tier: 2, guardians: ['尚书令·达利欧', '国子监·吴恩达'] },
  li_bu:          { tier: 2, guardians: ['尚书令·达利欧'] },
  li_bu_rites:    { tier: 2, guardians: ['侍中·张小龙'] },
  bing_bu:        { tier: 2, guardians: ['大鸿胪·索罗斯'] },
  qin_tian_jian:  { tier: 2, guardians: ['太史令·塔勒布'] },
  jin_yi_wei:     { tier: 2, guardians: ['司天监·Schneier'] },
  tai_yi_yuan:    { tier: 2, guardians: ['少府·大野耐一'] },
};

const strict = process.env.GUARDIAN_STRICT === '1';
const msgFile = process.argv[2]; // commit-msg 钩子传入；顾问模式为 undefined

function stagedFiles() {
  try {
    const files = git(['diff', '--cached', '--name-only']).split('\n').map((s) => s.trim()).filter(Boolean);
    if (files.length) return files;
  } catch { /* 非 git 环境，落空 */ }
  // 顾问模式无暂存内容时，退回与 HEAD 的工作区 diff
  try {
    return git(['diff', '--name-only', 'HEAD']).split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

// 命中判据：文件路径含司码 token。agent.ts 视为触达全部司(共享 contract)。
// 边界：码前须为非小写字母；码后不得紧跟小写字母(允许 _ / . - 等分隔，故 xing_bu_x、xing_bu/ 都中)。
// 唯一陷阱 li_bu ⊂ li_bu_rites：给 li_bu 加负向先行 (?!_rites)，让 li_bu_rites 路径只记 li_bu_rites。
function codeRe(code) {
  const tail = code === 'li_bu' ? '(?!_rites)(?![a-z])' : '(?![a-z])';
  return new RegExp(`(^|[^a-z])${code}${tail}`);
}
function hitCodes(files) {
  const hit = new Set();
  for (const f of files) {
    if (/src\/lib\/contracts\/agent\.ts$/.test(f)) { Object.keys(GUARDIANS).forEach((c) => hit.add(c)); continue; }
    for (const code of Object.keys(GUARDIANS)) {
      if (codeRe(code).test(f)) hit.add(code);
    }
  }
  return [...hit];
}

const files = stagedFiles();
const codes = hitCodes(files);

if (codes.length === 0) {
  console.log('✅ guard:guardian — 本次改动未命中任何司的运行态/contract 路径，无需守护会审。');
  process.exit(0);
}

const tier1 = codes.filter((c) => GUARDIANS[c].tier === 1);

console.log(`🏛️ guard:guardian — 本次改动触达 ${codes.length} 司：`);
for (const c of codes) {
  const g = GUARDIANS[c];
  console.log(`  · ${c} [梯队${g.tier}] → 守护大神：${g.guardians.join(' + ')}`);
}

// 顾问模式：只认领，不把门
if (!msgFile) {
  console.log('\n（顾问模式。把门请走 commit-msg 钩子：commit body 加一行 `守护: <大神> — <一句会审结论>`。）');
  process.exit(0);
}

// 把门模式：读 commit msg，查 tier1 司是否有对应 `守护:` 行
let msg = '';
try { msg = readFileSync(msgFile, 'utf8'); } catch { /* ignore */ }
const hasGuardLine = /(^|\n)\s*守护[:：]/.test(msg);

const need = tier1; // 只对已真转的户/刑/工强制(守铁律5)
if (need.length === 0) {
  console.log('\nℹ️ 触达的均为骨架司(梯队2)，standby——提示已给，不阻断(铁律5)。');
  process.exit(0);
}
if (hasGuardLine) {
  console.log('\n✅ commit body 含 `守护:` 行，视为已留铁律4 会审痕。放行。');
  process.exit(0);
}

console.log(`\n${strict ? '❌' : '⚠️ '} 触达已真转司 [${need.join(', ')}] 但 commit body 无 \`守护:\` 行。`);
console.log('   按 AGENTS.md §12.1，写共享主表/给决策加视觉权重等高危改动须留独立会审痕。');
console.log('   补一行如：`守护: 司天监·Schneier — 验签路径已核，伪造签名回归断言已加`');
process.exit(strict ? 1 : 0);
