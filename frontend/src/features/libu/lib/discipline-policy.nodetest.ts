import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDisciplinePolicy, matchDiscipline } from './discipline-policy.ts';

/**
 * 吏部违纪处罚引擎回归（2026-07-01）。会咬：删"未命中返 null"→ 编罚则用例红。
 */
const ROWS: unknown[][] = [
  ['行政部管理制度\n员工违纪惩处标准'],
  ['序号', '违纪内容', '惩 处 标 准'],
  ['1', '迟到，早退', '参照《考勤管理制度》'],
  ['4', '指定参加会议、培训，迟到或无故不参加者', '书面警告，罚款 50 元，情节严重者开除'],
  ['10', '最后一个离开的员工未锁办公室大门', '书面警告，罚款 200 元，情节严重者开除'],
];

test('解析真表结构 → 3 条规则', () => {
  const rules = parseDisciplinePolicy(ROWS);
  assert.equal(rules.length, 3);
  assert.equal(rules[0].violation, '迟到，早退');
  assert.ok(rules[1].penalty.includes('50'));
});

test('查询命中 → 返公司真标准', () => {
  const rules = parseDisciplinePolicy(ROWS);
  const m = matchDiscipline(rules, '员工培训无故不参加怎么罚');
  assert.equal(m.matched, true);
  assert.ok(m.rule?.penalty.includes('50'));
  assert.ok(m.note.includes('第 4 条'));
});

test('查不到 → 标需人事裁量，不编罚则（诚实边界）', () => {
  const rules = parseDisciplinePolicy(ROWS);
  const m = matchDiscipline(rules, '外星人入侵');
  assert.equal(m.matched, false);
  assert.equal(m.rule, null);
  assert.ok(m.note.includes('人事裁量'));
});

test('空表/空查询不炸', () => {
  assert.deepEqual(parseDisciplinePolicy([]), []);
  assert.equal(matchDiscipline([], '任意').matched, false);
});
