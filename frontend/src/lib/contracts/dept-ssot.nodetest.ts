import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DEPT_TO_AGENT_CODE,
  DEPT_DISPLAY,
  DEPARTMENT_IDENTITIES,
  departmentNameCn,
  isPrivacySensitiveDepartment,
  MINISTRY_IDS,
  resolveDepartmentAgentCode,
  SIX_MINISTRY_CANONICAL_CODES,
  UNIFIED_DEPARTMENT_IDS,
  V1_LIUBU_CANONICAL_CODES,
} from './dept.ts';
import { AGENT_META } from './agent.ts';
import { agentCodeForDept } from '../department-learning/advisor-signal.ts';
import { DEPT_CN, shouldRedactDepartmentCommand } from '../swarm/decision-ledger.ts';
import { swarmToCn } from '../swarm/dept-identity.ts';
import { MINISTRY_REGISTRY } from '../../core/courtos/ministries/ministry-registry.ts';
import { DEPARTMENT_REGISTRY } from '../../core/courtos/unified/department-registry.ts';
import { SIX_DEPARTMENTS } from '../../features/departments/lib/six-departments-content.ts';
import { CHAOTANG_V1_LIUBU } from '../../config/chaotang-v1-modules.ts';

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

test('li_bu 身份纠正为吏部，同时显式保留人事隐私脱敏语义', () => {
  assert.equal(departmentNameCn('li_bu'), '吏部');
  assert.equal(isPrivacySensitiveDepartment('li_bu'), true);
  assert.equal(shouldRedactDepartmentCommand('li_bu'), true);
  assert.equal(resolveDepartmentAgentCode('li_bu'), 'li_bu');
});

test('六部/统一/v1 注册表的 ID 集合与中文名均派生自 dept.ts', () => {
  assert.deepEqual(Object.keys(MINISTRY_REGISTRY), [...MINISTRY_IDS]);
  for (const [id, item] of Object.entries(MINISTRY_REGISTRY)) {
    assert.equal(item.id, id);
    assert.equal(item.nameCn, departmentNameCn(id));
  }

  const unifiedIds = UNIFIED_DEPARTMENT_IDS.map((code) => DEPARTMENT_IDENTITIES[code].unifiedId);
  assert.deepEqual(Object.keys(DEPARTMENT_REGISTRY), unifiedIds);
  for (const [id, item] of Object.entries(DEPARTMENT_REGISTRY)) {
    assert.equal(item.id, id);
    assert.equal(item.name, departmentNameCn(id));
  }

  assert.deepEqual(Object.keys(SIX_DEPARTMENTS).sort(), [...SIX_MINISTRY_CANONICAL_CODES].sort());
  assert.deepEqual(
    CHAOTANG_V1_LIUBU.map((item) => item.canonicalCode),
    [...V1_LIUBU_CANONICAL_CODES],
  );
  for (const item of CHAOTANG_V1_LIUBU) assert.equal(item.name, departmentNameCn(item.canonicalCode ?? ''));
});

test('repo grep guard: dept.ts 外不再定义平行部门身份字典', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const consumers = [
    'src/lib/swarm/dept-identity.ts',
    'src/lib/swarm/decision-ledger.ts',
    'src/lib/swarm/merge.ts',
    'src/lib/department-learning/advisor-signal.ts',
    'src/lib/department-learning/real-source.ts',
    'src/lib/department-learning/archive-backfill.ts',
    'src/core/courtos/ministries/ministry-registry.ts',
    'src/core/courtos/unified/department-registry.ts',
    'src/features/departments/lib/six-departments-content.ts',
    'src/config/chaotang-v1-modules.ts',
  ];
  const forbidden = [
    /(?:const|let|var)\s+SWARM_CODE_CN\s*[:=]/,
    /(?:const|let|var)\s+DEPT_TO_AGENT\s*[:=]/,
    /export\s+const\s+DEPT_CN[^=]*=\s*\{/,
    /export\s+const\s+DEPARTMENT_NAME_CN[^=]*=\s*\{/,
    /export\s+const\s+V1_DEPARTMENT_ALIASES[^=]*=\s*\{/,
    /export\s+const\s+MINISTRY_TO_DEPT_CODE[^=]*=\s*\{/,
    /export\s+type\s+DeptCode\s*=\s*\|?\s*'/,
    /export\s+type\s+MinistryId\s*=\s*'/,
    /export\s+type\s+UnifiedDepartmentId\s*=\s*\|?\s*'/,
    /export\s+type\s+SixDepartmentCode\s*=\s*'/,
    /export\s+type\s+V1CanonicalDepartmentCode\s*=/,
    /export\s+type\s+DepartmentPageCanonicalCode\s*=\s*'/,
  ];

  for (const relative of consumers) {
    const source = readFileSync(`${root}/${relative}`, 'utf8');
    assert.match(source, /contracts\/dept(?:\.ts)?['"]/, `${relative} 必须 import contracts/dept.ts`);
  }

  const walk = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
    const path = `${directory}/${name}`;
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  for (const path of walk(`${root}/src`)) {
    if (!/\.(?:ts|tsx)$/.test(path) || path.endsWith('/lib/contracts/dept.ts') || path.endsWith('.nodetest.ts')) continue;
    const source = readFileSync(path, 'utf8');
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${path.slice(root.length + 1)} 仍含平行部门身份定义: ${pattern}`);
    }
  }
});
