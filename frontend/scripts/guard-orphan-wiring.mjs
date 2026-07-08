#!/usr/bin/env node
/**
 * guard:orphan-wiring (2026-07-04 · "团队级模式"排查第10项落地：把人肉发现变可重跑检查)。
 *
 * 背景：用户抛出观察"团队擅长把设计写精美，但接线系统性掉队"，派4个Explore agent逐条核实，
 * 3/4属实——其中钦天监两个招牌能力(computeCycleHeat/tail-audit.ts、reviewRiskTiming/
 * risk-timing-review.ts)是"整个文件的核心导出，除自己的nodetest外全仓零引用"这个形状。
 * 之前靠人肉怀疑+现场排查才挖出来，本guard把这个动作自动化。
 *
 * 设计取舍(2026-07-04 首版跑出175个孤儿导出候选后重新收窄)：
 *   - 不按"单个导出零引用"判定——任何真实代码库里都有大量"暂时没人调的小helper"，逐个导出
 *     判会产生175+条噪声，噪声审计=被忽略的审计(同realdata-truth-audit.mjs的心法)。
 *   - 改按"整个文件的所有导出都零引用"判定——这才对应"一整个能力模块被建成孤岛"的真实模式，
 *     而不是"某个工具函数还没轮到它被用"的正常状态。信号更强、噪声更少。
 *   - 只扫 src/core/courtos/** (不含 src/features/**)——crown-jewel能力层，历史命中都在这。
 *     features/** 目录组件互相引用模式更复杂(JSX隐式引用/动态import)，误报率会更高。
 *
 * 用法: node scripts/guard-orphan-wiring.mjs (或 pnpm guard:orphan-wiring)
 * 默认 warn-only(exit 0)；ORPHAN_STRICT=1 时有新增孤儿文件(不在FROZEN_ALLOWLIST里)才 exit 1。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIR = join(ROOT, 'src', 'core', 'courtos');

// 已知且已在 dev/notes 里记录为"故意冻结"的文件，不算新发现，仅报告标注，不计入告警。
// 加入前必须有对应 dev/notes 记录，防止把"忘了接线"伪装成"故意冻结"。
const FROZEN_ALLOWLIST = new Set([
  'src/core/courtos/qintian/tail-audit.ts', // dev/notes/团队级模式-文档层滚动滞后-2026-07-04.md
]);

const EXCLUDE_DIR_RE = /(^|\/)(__tests__|__mocks__|dev\/_attic)(\/|$)/;
const EXCLUDE_FILE_RE = /\.(nodetest|test|spec|d)\.[jt]sx?$/;

function walk(dir, out = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) {
      if (EXCLUDE_DIR_RE.test(p)) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e) && !EXCLUDE_FILE_RE.test(e)) {
      out.push(p);
    }
  }
  return out;
}

const candidateFiles = walk(SCAN_DIR);
// 引用检索需要看全仓(route.ts 在 src/app/api 下引用 core/courtos 的 lib 导出很常见)。
const wholeSrc = walk(join(ROOT, 'src'));
const fileTexts = new Map();
for (const f of new Set([...candidateFiles, ...wholeSrc])) {
  try { fileTexts.set(f, readFileSync(f, 'utf8')); } catch { /* skip unreadable */ }
}

// ponytail: 第三次正则漏报后再收紧——原正则只认 function/const/class，完全不认
// `export type X` / `export interface X`。types.ts 这类以类型导出为主、只带一个
// 零引用const的文件，会被误判"全部导出零引用"(该文件的SourceLabel/RiskLevel等类型
// 导出其实被19个文件import，真正孤儿的只是COURT_CORE_TASK_STATES这一个const，不是整个文件)。
const EXPORT_RE = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=|export\s+class\s+([A-Za-z_$][\w$]*)|export\s+type\s+([A-Za-z_$][\w$]*)|export\s+interface\s+([A-Za-z_$][\w$]*)/g;

const orphanFiles = [];
for (const file of candidateFiles) {
  const txt = fileTexts.get(file) ?? '';
  const names = [];
  let m;
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(txt))) {
    const name = m[1] || m[2] || m[3] || m[4] || m[5];
    if (name && name.length >= 4) names.push(name);
  }
  if (names.length === 0) continue; // 无具名导出(如纯类型文件)，跳过

  // 该文件"全部导出"是否都在别处零引用——只要任一导出在别处被引用，就不算孤儿文件
  // (说明模块至少部分接上了)。
  let anyReferenced = false;
  for (const name of names) {
    for (const [f, otherTxt] of fileTexts) {
      if (f === file) continue;
      if (otherTxt.includes(name)) { anyReferenced = true; break; }
    }
    if (anyReferenced) break;
  }
  if (!anyReferenced) orphanFiles.push({ file: relative(ROOT, file), exportCount: names.length, sample: names.slice(0, 3) });
}

const strict = process.env.ORPHAN_STRICT === '1';
const newOrphans = orphanFiles.filter((o) => !FROZEN_ALLOWLIST.has(o.file));
const frozenOrphans = orphanFiles.filter((o) => FROZEN_ALLOWLIST.has(o.file));

console.log('═══ guard:orphan-wiring · 设计精美但零接线 候选扫描(文件粒度) ═══');
console.log(`扫描范围: src/core/courtos/** (共 ${candidateFiles.length} 文件)`);

if (frozenOrphans.length > 0) {
  console.log(`\n🧊 已知冻结(见FROZEN_ALLOWLIST，非新发现): ${frozenOrphans.length} 个`);
  for (const o of frozenOrphans) console.log(`  · ${o.file}  (导出: ${o.sample.join('/')}...)`);
}

if (newOrphans.length === 0) {
  console.log('\n✅ 无新的孤儿模块候选(除已知冻结项外，其余文件至少有一个导出在别处被引用)。');
  process.exit(0);
}

console.log(`\n⚠️ ${newOrphans.length} 个孤儿模块候选(整个文件的所有导出全仓零引用，需人工判断)：`);
for (const o of newOrphans) console.log(`  ⚠️ ${o.file}  (${o.exportCount}个导出，如: ${o.sample.join('/')})`);
console.log('\n处理方式二选一：① 确认是设计已暂停/等真实consumer，补进dev/notes+本脚本FROZEN_ALLOWLIST；');
console.log('              ② 确认是真的忘了接线，接上真实调用路径。禁止两者都不做地放着。');
console.log('（启发式会有误报：名字被字符串/注释提及也算"引用"，宁可漏报也不误伤。文件粒度而非');
console.log('  单导出粒度——避免把"暂时没人调的小helper"跟"整个能力被建成孤岛"混为一谈。）');
process.exit(strict && newOrphans.length > 0 ? 1 : 0);
