/**
 * 史馆召回租户隔离守卫回归断言(铁律4·CRITICAL#3 命门)。跑: pnpm test:node
 * 验收定义=负向断言:跨租户/anonymous/无括号一律不得放行(半拉子修复在正向断言下照样全绿却仍裸奔)。
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { isRecallableUser, buildRecallQuery, buildArchiveRecordsRecallQuery, extractRecallTerms } from './recall-guard.ts';

// ── default-deny:谁可召回 ──
test('可召回判定:具体登录用户=可,anonymous/空/缺失=不可', () => {
  assert.equal(isRecallableUser('userA'), true);
  assert.equal(isRecallableUser('anonymous'), false);
  assert.equal(isRecallableUser(''), false);
  assert.equal(isRecallableUser(null), false);
  assert.equal(isRecallableUser(undefined), false);
});

// ── fail-closed:不可召回一律返回 null(不查全表) ──
test('fail-closed:anonymous→null(只写不召)', () => {
  assert.equal(buildRecallQuery('和供应商的独家合同报价', 'anonymous'), null);
});
test('fail-closed:空/缺失 userId→null,绝不退化全表', () => {
  assert.equal(buildRecallQuery('和供应商的独家合同报价', ''), null);
  assert.equal(buildRecallQuery('和供应商的独家合同报价', null), null);
});
test('fail-closed:无有效关键词→null', () => {
  assert.equal(buildRecallQuery('a b c', 'userA'), null); // 全是 <2 字
});

// ── 命门:OR 链整组括号 + user_id 强等值(负向) ──
test('命门:user_id 谓词以 AND 连接(绝不被 OR 短路)', () => {
  const q = buildRecallQuery('和供应商的独家合同报价', 'userA');
  assert.ok(q, '合法用户应有查询');
  // user_id = ? 后必须紧跟 AND(若写成 user_id = ? OR ... 则泄露原样复活)
  assert.match(q!.sql, /user_id = \?\s+AND/, 'user_id 必须 AND 连接');
  // term 的 OR 链必须整组括号
  assert.match(q!.sql, /AND \(original_question LIKE \?/, 'OR 链必须整组加括号');
  assert.ok(!/user_id = \?\s+OR/.test(q!.sql), '严禁 user_id = ? OR(会短路泄露)');
});

test('命门:userId 是第一个 arg(强过滤在最前)', () => {
  const q = buildRecallQuery('和供应商的独家合同报价', 'userA');
  assert.equal(q!.args[0], 'userA');
});

// ── 合成/DEMO/FALLBACK 不进召回 ──
test('过滤:synthetic=0 + 排除 DEMO/FALLBACK 源标', () => {
  const q = buildRecallQuery('和供应商的独家合同报价', 'userA');
  assert.match(q!.sql, /synthetic = 0/, '合成案不漂白');
  assert.match(q!.sql, /source_label NOT IN \(\?,\?\)/, 'DEMO/FALLBACK 排除');
  assert.ok(q!.args.includes('DEMO') && q!.args.includes('FALLBACK'));
});

// ── 关键词抽取 ──
test('关键词抽取:去重,上限 12', () => {
  const terms = extractRecallTerms('独家 合同 报价 独家 交期 付款 验收 锁定');
  assert.ok(terms.length <= 12);
  assert.equal(new Set(terms).size, terms.length, '去重');
});

test('中文跨措辞召回:两句同题不同问法共享 n-gram(飞轮死结修复)', () => {
  const aQuestion = '华东大客户独家供货协议要不要签';
  const bQuestion = '华东大客户独家供货协议的账期怎么定';
  const A = extractRecallTerms(aQuestion);
  const B = extractRecallTerms(bQuestion);
  const shared = A.filter((t) => B.includes(t));
  assert.ok(shared.length >= 3, `换措辞应共享≥3个n-gram,实际${shared.length}: ${shared.join(',')}`);
  // B 的某个关键词是 A 原句子串 → LIKE %term% 能召回 A(飞轮闭合的前提)
  assert.ok(B.some((t) => aQuestion.includes(t)), 'B 的关键词应能 LIKE 命中 A 原句');
});

test('中文长句不再整句成词(旧死结:整句→只能一字不差召回)', () => {
  const terms = extractRecallTerms('华东大客户独家供货协议要不要签');
  assert.ok(!terms.includes('华东大客户独家供货协议要不要签'), '整句不应作为单一 term');
  assert.ok(terms.every((t) => t.length <= 4), '全部为 ≤4 字片段');
});

// ── 阶段4② archive_records 桥接(2026-07-03)：同款命门,不同表 ──
test('archive_records 召回:fail-closed(anonymous/空/缺失/无关键词→null)', () => {
  assert.equal(buildArchiveRecordsRecallQuery('低温电池市场分析', 'anonymous'), null);
  assert.equal(buildArchiveRecordsRecallQuery('低温电池市场分析', ''), null);
  assert.equal(buildArchiveRecordsRecallQuery('低温电池市场分析', null), null);
  assert.equal(buildArchiveRecordsRecallQuery('a b c', 'userA'), null);
});

test('archive_records 命门:user_id(json_extract)以 AND 连接,绝不被 term OR 短路', () => {
  const q = buildArchiveRecordsRecallQuery('低温电池市场分析', 'userA');
  assert.ok(q, '合法用户应有查询');
  assert.match(
    q!.sql,
    /json_extract\(archive_json, '\$\.issue\.userId'\) = \?\s+AND/,
    'user_id 提取谓词必须 AND 连接',
  );
  assert.ok(
    !/userId'\) = \?\s+OR/.test(q!.sql),
    '严禁 user_id 谓词后紧跟 OR(会短路泄露)',
  );
  assert.equal(q!.args[0], 'userA', 'userId 是第一个 arg(强过滤在最前)');
});

test('archive_records 命门:term 的 OR 链每组都整体括号(question/outcome/lessons 三路)', () => {
  const q = buildArchiveRecordsRecallQuery('低温电池市场分析', 'userA');
  assert.match(q!.sql, /AND \(\(json_extract\(archive_json, '\$\.issue\.question'\) LIKE \?/);
  assert.match(q!.sql, /json_extract\(archive_json, '\$\.outcome'\) LIKE \?/);
  assert.match(q!.sql, /json_each\(archive_json, '\$\.lessons'\)/, 'lessons 数组需 json_each 展开逐条匹配');
});

test('archive_records 召回:与 court_archives 隔离粒度一致(同一用户/同一问题应产生等量 term 的查询)', () => {
  const courtQuery = buildRecallQuery('低温电池市场分析', 'userA');
  const archiveQuery = buildArchiveRecordsRecallQuery('低温电池市场分析', 'userA');
  assert.ok(courtQuery && archiveQuery);
  // 两边用同一套 extractRecallTerms，term 数量应相同(仅 SQL 目标表/字段不同)。
  const courtTermCount = (courtQuery!.sql.match(/LIKE \?/g) ?? []).length;
  const archiveTermCount = (archiveQuery!.sql.match(/LIKE \?/g) ?? []).length;
  assert.equal(archiveTermCount, courtTermCount * 3, 'archive_records 每个 term 对应3路匹配(question/outcome/lessons)');
});
