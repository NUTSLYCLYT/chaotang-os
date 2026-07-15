/**
 * P1 residual F1：跨端 SSOT parity 守门。
 *
 * 后端 harness/chaotang_department_protocol/departments.yaml（v1_taxonomy.liubu）
 * 与前端 DEPARTMENT_IDENTITIES 是两个 SSOT；本测试是二者之间唯一的机器对齐门：
 * yaml key ↔ v1Code、agent_code ↔ agentCode、name ↔ nameCn、
 * legacy_api_slugs ⊆ aliases。任何一端改身份而另一端未改，这里必须红。
 *
 * 注意：runtime_code 命名空间与前端 aliases 故意不对齐（runtime 'libu'=礼部，
 * 前端 alias 'libu'=吏部——见 backend/src/department_identity.py 的两义说明），
 * 因此本测试不断言 runtime_code。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { DEPARTMENT_IDENTITIES } from './dept';

const YAML_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../backend/harness/chaotang_department_protocol/departments.yaml',
);

type YamlMinistry = {
  key: string;
  name: string;
  agentCode: string;
  legacySlugs: string[];
};

// ponytail: 定向行解析器，只认本仓 departments.yaml 的固定缩进格式；
// 格式漂移时 parse 数量断言会失败，届时升级为真 yaml 解析。
function parseLiubu(yamlText: string): YamlMinistry[] {
  const lines = yamlText.split('\n');
  const start = lines.findIndex((l) => /^ {2}liubu:\s*$/.test(l));
  assert.notEqual(start, -1, 'departments.yaml 缺少 v1_taxonomy.liubu 节');
  const out: YamlMinistry[] = [];
  let cur: YamlMinistry | null = null;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^ {2}\S/.test(line)) break; // liubu 节结束（回到 2 空格层）
    const keyMatch = line.match(/^ {4}([a-z_]+):\s*$/);
    if (keyMatch) {
      cur = { key: keyMatch[1], name: '', agentCode: '', legacySlugs: [] };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    const name = line.match(/^ {6}name:\s*(\S+)\s*$/);
    if (name) cur.name = name[1];
    const agent = line.match(/^ {6}agent_code:\s*(\S+)\s*$/);
    if (agent) cur.agentCode = agent[1];
    const slugs = line.match(/^ {6}legacy_api_slugs:\s*\[([^\]]*)\]\s*$/);
    if (slugs) cur.legacySlugs = slugs[1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

const yamlMinistries = parseLiubu(readFileSync(YAML_PATH, 'utf-8'));
const identities = Object.entries(DEPARTMENT_IDENTITIES) as Array<
  [string, { agentCode: string; nameCn: string; aliases: readonly string[]; v1Code?: string }]
>;
const identitiesWithV1Code = identities.filter(([, identity]) => identity.v1Code);
const byV1Code = new Map(
  identitiesWithV1Code.map(([code, identity]) => [identity.v1Code as string, { code, ...identity }]),
);

test('前端 v1Code 无重复（Map 折叠会静默吞掉重复项，必须显式断言）', () => {
  assert.equal(
    byV1Code.size,
    identitiesWithV1Code.length,
    `v1Code 存在重复：${identitiesWithV1Code
      .map(([, identity]) => identity.v1Code)
      .filter((code, i, all) => all.indexOf(code) !== i)
      .join(', ')}`,
  );
});

test('departments.yaml liubu 节解析出全部六部且字段齐全', () => {
  assert.equal(yamlMinistries.length, 6, `期望 6 部，实际 ${yamlMinistries.length}——yaml 格式或部门数变化`);
  for (const m of yamlMinistries) {
    assert.ok(m.name, `${m.key} 缺 name`);
    assert.ok(m.agentCode, `${m.key} 缺 agent_code`);
    assert.ok(m.legacySlugs.length > 0, `${m.key} 缺 legacy_api_slugs`);
  }
});

test('后端 yaml 每部在前端 dept.ts 有唯一 v1Code 对应且 agent_code/name 一致', () => {
  for (const m of yamlMinistries) {
    const fe = byV1Code.get(m.key);
    if (!fe) throw new Error(`yaml ${m.key} 在前端 DEPARTMENT_IDENTITIES 无 v1Code 对应`);
    assert.equal(fe.agentCode, m.agentCode, `${m.key}: 后端 agent_code=${m.agentCode} 前端 agentCode=${fe.agentCode}`);
    assert.equal(fe.nameCn, m.name, `${m.key}: 后端 name=${m.name} 前端 nameCn=${fe.nameCn}`);
  }
});

test('后端 legacy_api_slugs 全部收编进前端 aliases', () => {
  for (const m of yamlMinistries) {
    const fe = byV1Code.get(m.key);
    if (!fe) throw new Error(`yaml ${m.key} 前端缺对应`);
    for (const slug of m.legacySlugs) {
      assert.ok(fe.aliases.includes(slug), `${m.key}: legacy slug '${slug}' 不在前端 aliases`);
    }
  }
});

test('前端带 v1Code 的身份反向全部存在于后端 yaml', () => {
  const yamlKeys = new Set(yamlMinistries.map((m) => m.key));
  for (const [v1Code, fe] of byV1Code) {
    assert.ok(yamlKeys.has(v1Code), `前端 ${fe.code} 的 v1Code='${v1Code}' 在 yaml liubu 中不存在`);
  }
});
