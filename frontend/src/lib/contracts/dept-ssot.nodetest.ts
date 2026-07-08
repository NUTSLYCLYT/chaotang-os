import assert from 'node:assert/strict';
import test from 'node:test';
import { DEPT_TO_AGENT_CODE, DEPT_DISPLAY } from './dept.ts';
import { AGENT_META } from './agent.ts';
import { agentCodeForDept } from '../department-learning/advisor-signal.ts';
import { DEPT_CN } from '../swarm/decision-ledger.ts';
import { swarmToCn } from '../swarm/dept-identity.ts';

/**
 * 铁律2 回归（部门命名 SSOT 防漂移）：
 * contracts/dept.ts 的 DEPT_TO_AGENT_CODE 是部门码→AgentCode 的【单一真相源】。
 * 全仓另有 ≥4 处并行副本(advisor-signal/dept-identity/decision-ledger/intentDetector)——
 * 它们一旦与 SSOT 漂移,boss_preferences/飞轮计数器会写进永不匹配的孤儿边、静默空转(铁律2 案例)。
 * 本断言钉死:① SSOT 自身内部一致 ② SSOT 的 agentCode 都是真 Tier-0 码
 *           ③ advisor-signal 的 dept→agent 映射(背后自有副本)必须与 SSOT 一致。
 * 会咬:把 advisor-signal 的 DEPT_TO_AGENT 改成 finance→li_bu 之类→③红。
 */

const META_CODES: Set<string> = new Set(
  Array.isArray(AGENT_META)
    ? (AGENT_META as Array<{ code: string }>).map((m) => m.code)
    : Object.keys(AGENT_META as Record<string, unknown>),
);

test('SSOT 内部一致:DEPT_TO_AGENT_CODE 与 DEPT_DISPLAY 同键集', () => {
  const a = Object.keys(DEPT_TO_AGENT_CODE).sort();
  const b = Object.keys(DEPT_DISPLAY).sort();
  assert.deepEqual(a, b, 'DEPT_TO_AGENT_CODE 与 DEPT_DISPLAY 的部门键必须一致');
});

test('SSOT 的每个 agentCode 都是真 Tier-0 AGENT_META 码', () => {
  for (const [dept, code] of Object.entries(DEPT_TO_AGENT_CODE)) {
    assert.ok(META_CODES.has(code), `SSOT dept '${dept}'→'${code}' 不是合法 AGENT_META 码`);
  }
});

test('advisor-signal 的 dept→agent 副本不漂移(必须与 SSOT 一致)', () => {
  for (const [dept, code] of Object.entries(DEPT_TO_AGENT_CODE)) {
    assert.equal(
      agentCodeForDept(dept),
      code,
      `advisor-signal 对部门 '${dept}' 的映射漂移了(应=${code}，实=${agentCodeForDept(dept)}) —— 铁律2:改副本前先改 SSOT`,
    );
  }
});

test('decision-ledger DEPT_CN 的 canonical 6 派生自 SSOT(不漂移)', () => {
  for (const [dept, d] of Object.entries(DEPT_DISPLAY)) {
    assert.equal(
      DEPT_CN[dept],
      d.nameCn,
      `decision-ledger DEPT_CN['${dept}'] 应=SSOT 中文名 '${d.nameCn}'(已派生,改 SSOT 即跟)`,
    );
  }
});

test('跨命名权威:contracts/dept 与 dept-identity 的中文名一致(铁律2 跨SSOT不漂移)', () => {
  for (const [dept, d] of Object.entries(DEPT_DISPLAY)) {
    assert.equal(
      swarmToCn(dept),
      d.nameCn,
      `部门 '${dept}':dept-identity(swarmToCn='${swarmToCn(dept)}') 与 contracts/dept('${d.nameCn}') 中文名漂移`,
    );
  }
});

test('AGENT_META 码经 agentCodeForDept 自反(码本身能解析回自己)', () => {
  for (const code of DEPT_TO_AGENT_CODE ? Object.values(DEPT_TO_AGENT_CODE) : []) {
    if (META_CODES.has(code)) {
      assert.equal(agentCodeForDept(code), code, `AgentCode '${code}' 应自反解析`);
    }
  }
});
