#!/usr/bin/env node
/**
 * 接真度真值审计(2026-06-24 · deming 天才建议:把"接真度"从手写声明变成每次 build 可见的对账)
 *
 * 盲区:AGENT_META.realDataConnected 是手写声明、会漂移;部门 client 实际渲染 mock/seed
 * 却没人对账 → "标了 LIVE 就以为真接通"。本审计把两侧并排成真值表,声明=true 但 client
 * 仍渲染 mock = 漂移(drift),列⚠️。让"七部里到底几部真接了真数据"成 CI 每次复核的数字。
 *
 * SSOT(不另造平行表,铁律2):
 *   - 声明源: src/lib/contracts/agent.ts 的 realDataConnected
 *   - 对客部门↔agent 码: src/lib/contracts/dept.ts 的 DEPT_TO_AGENT_CODE + DEPT_DISPLAY
 *   - client 实况: 扫 src/features/* 真文件(谁提到该 agent 码 + 是否带 mock 标记)
 *
 * 默认 warn-only(exit 0):这是可见性对账,非阻断门。REALDATA_STRICT=1 时漂移即 exit 1。
 * 用法:node scripts/realdata-truth-audit.mjs   (或 pnpm guard:realdata)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const AGENT_TS = 'src/lib/contracts/agent.ts';
const DEPT_TS = 'src/lib/contracts/dept.ts';
const FEATURES_DIR = 'src/features';

// client 渲染假数据的信号(与 honesty-debt-audit 同源理念)
const MOCK_RE = /MOCK_[A-Z]|SEED_[A-Z]|getDeptSeed|['"]seed['"]|['"]mock['"]|source:\s*['"](seed|mock|fallback)['"]|示意|假数据/;

// 已人工核实为诚实用法(非渲染假数据)的文件,豁免出漂移 —— 让 0 漂移=真干净,审计不'狼来了'(2026-06-25)。
// 加入前必须核实:该处 'mock' 仅是配置开关/类型联合标签等,绝非把假数据当真渲染。
const MOCK_ALLOWLIST = new Set([
  'auth/lib/session-auth.ts',          // NEXT_PUBLIC_API_MODE === 'mock' 配置开关(非数据)
  'operating-loop/lib/daily-brief.ts', // source: ... | 'mock' 类型联合标签(非渲染假数据)
  'shangshufang/ShangshufangPage.tsx', // coverage.absent.kind === 'seed':未设 agent 覆盖率标签,非假数据渲染
]);
// 真接 API 的信号
const REAL_RE = /swrFetcher|useSWR|fetch\(|['"`]\/api\//;

function read(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

/** 解析 agent.ts:每个 agent 的 code + 中文名 + realDataConnected */
function parseAgents(src) {
  const out = [];
  // 按 "code: '<x>'" 切块,块内找 nameCn/name 与 realDataConnected
  const re = /code:\s*'([a-z_]+)'/g;
  let m;
  const idxs = [];
  while ((m = re.exec(src))) idxs.push({ code: m[1], at: m.index });
  for (let i = 0; i < idxs.length; i++) {
    const start = idxs[i].at;
    const end = i + 1 < idxs.length ? idxs[i + 1].at : src.length;
    const block = src.slice(start, end);
    const rdc = /realDataConnected:\s*(true|false)/.exec(block);
    if (!rdc) continue; // 非 agent 块(如类型声明)无此字段,跳过
    const cn = /nameCn:\s*'([^']+)'/.exec(block) || /name:\s*'([^']+)'/.exec(block);
    out.push({ code: idxs[i].code, nameCn: cn ? cn[1] : idxs[i].code, declared: rdc[1] === 'true' });
  }
  return out;
}

/** 解析 dept.ts:DEPT_TO_AGENT_CODE(deptCode→agentCode) + 中文名 */
function parseDeptBridge(src) {
  const bridge = {};
  const sec = /DEPT_TO_AGENT_CODE[^{]*\{([^}]+)\}/.exec(src);
  if (sec) {
    const re = /(\w+):\s*'([a-z_]+)'/g;
    let m;
    while ((m = re.exec(sec[1]))) bridge[m[1]] = m[2];
  }
  return bridge;
}

/** 扫 src/features/*:每个 agent 码,哪些 feature 文件提到它 + 是否带 mock/真 API 标记 */
function scanFeatureReality(agentCodes, swarmHints) {
  const byAgent = {}; // code -> { mockFiles:Set, realFiles:Set }
  for (const c of agentCodes) byAgent[c] = { mock: new Set(), real: new Set() };
  let dirs = [];
  try { dirs = readdirSync(FEATURES_DIR).filter((d) => statSync(join(FEATURES_DIR, d)).isDirectory()); } catch { return byAgent; }
  const walk = (dir) => {
    let entries = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { walk(p); continue; }
      if (!/\.(tsx?|jsx?)$/.test(e)) continue;
      // 排除非渲染面:测试/类型/纯 lib 不是 client,计进来只会冤枉部门。
      if (/\.(nodetest|test|spec)\.[jt]sx?$/.test(e)) continue;
      if (/(^|\/)(types|__tests__|__mocks__)(\/|$)/.test(p) || /\.d\.ts$/.test(e)) continue;
      const txt = read(p);
      const hasMock = MOCK_RE.test(txt);
      const hasReal = REAL_RE.test(txt);
      if (!hasMock && !hasReal) continue;
      // 命中的 agent 码集合;引用 >3 个 = 跨切面 hub(如 imperial 总览),不归任何单部门,
      // 否则 hub 的 mock 会冤枉每个部门,把审计淹成噪声(噪声审计=被忽略的审计)。
      const matched = agentCodes.filter((c) => {
        const hints = [c, ...(swarmHints[c] || [])];
        return hints.some((h) => txt.includes(`'${h}'`) || txt.includes(`"${h}"`) || txt.includes(`/${h}`));
      });
      if (matched.length === 0 || matched.length > 3) continue;
      const rel = p.replace(`${FEATURES_DIR}/`, '');
      const mockCounts = hasMock && !MOCK_ALLOWLIST.has(rel); // 诚实用法豁免,不计漂移
      for (const c of matched) {
        if (mockCounts) byAgent[c].mock.add(rel);
        if (hasReal) byAgent[c].real.add(rel);
      }
    }
  };
  for (const d of dirs) walk(join(FEATURES_DIR, d));
  return byAgent;
}

const agents = parseAgents(read(AGENT_TS));
const bridge = parseDeptBridge(read(DEPT_TS)); // deptCode -> agentCode
// 对客部门的 swarm 码提示(从 dept bridge 的 key 反推,帮助在 feature 文件里命中)
const swarmHints = {};
for (const [deptCode, agentCode] of Object.entries(bridge)) {
  (swarmHints[agentCode] ||= []).push(deptCode);
}
const reality = scanFeatureReality(agents.map((a) => a.code), swarmHints);

console.log('═══ 朝堂接真度真值审计 · 部门 × 真数据 ═══');
const declaredTrue = agents.filter((a) => a.declared).length;
console.log(`声明接真(realDataConnected:true): ${declaredTrue}/${agents.length}\n`);

const drift = [];
const head = '  部门(码)'.padEnd(22) + '声明接真'.padEnd(10) + 'client实况';
console.log(head);
console.log('  ' + '─'.repeat(52));
for (const a of agents) {
  const r = reality[a.code] || { mock: new Set(), real: new Set() };
  const mock = r.mock.size, real = r.real.size;
  let real状 = '—';
  if (real && mock) real状 = `接API×${real} + mock×${mock}`;
  else if (real) real状 = `接API×${real}(无mock)`;
  else if (mock) real状 = `仅mock×${mock}`;
  const decl = a.declared ? '✅true' : '❌false';
  const isDrift = a.declared && mock > 0;
  if (isDrift) drift.push(a);
  const label = `${a.nameCn}(${a.code})`;
  console.log(`  ${(isDrift ? '⚠️ ' : '   ') + label}`.padEnd(24) + decl.padEnd(12) + real状);
}

if (drift.length === 0) {
  console.log('\n✅ 无接真漂移:所有声明 realDataConnected:true 的 agent,其 client 未检出 mock 渲染。');
  process.exit(0);
}
console.log(`\n⚠️ 候选接真漂移 ${drift.length} 个(归属为启发式,需人工确认):声明"已接真"但相关面仍检出 mock/seed ——`);
for (const a of drift) {
  const files = [...(reality[a.code]?.mock || [])].slice(0, 3).join(' · ');
  console.log(`  ⚠️ ${a.nameCn}(${a.code}) → ${files || '(mock 文件)'}`);
}
console.log('\n要么把 client 真接上(去掉 mock),要么把 agent.realDataConnected 改回 false(诚实)。');
console.log('（deming:标签冒充接通是最贵的自欺;这条数字让它无处藏。）');
if (process.env.REALDATA_STRICT === '1') process.exit(1);
process.exit(0);
