import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCustomerRows, batchQualify } from './customer-import.ts';

const ROWS: unknown[][] = [
  ['序号', '地区', '单位', '姓名', '职位', '客户分类', '信息来源'],
  [1, '武汉', '中原电子集团', '朱先生', '项目经理', 'B', '列装竞标'],
  [2, '天津', '蓝天太阳科技', '李玉梅', '项目经理', 'B', '竞标'],
  [3, '深圳', '某贸易公司', '王先生', '采购', 'C', ''], // 无信号
];
const ICP = { industries: ['储能', '新能源', '电力电子'], signals: ['竞标', '采购', '列装'], disqualifiers: [] };

test('parseCustomerRows：按表头识别 + 信息来源抽信号 + 跳脏行', () => {
  const { prospects } = parseCustomerRows(ROWS);
  assert.equal(prospects.length, 3);
  assert.deepEqual(prospects[0].observedSignals, ['竞标', '列装']);
  assert.equal(prospects[0].source, 'user_provided');
});

test('batchQualify：有信号→待定，无信号→非目标；汇总正确', () => {
  const { prospects } = parseCustomerRows(ROWS);
  const b = batchQualify(prospects, ICP);
  assert.equal(b.total, 3);
  assert.equal(b.summary.maybe, 2); // 中原/蓝天有信号
  assert.equal(b.summary.not_target, 1); // 无信号那个
  assert.match(b.headline, /验完/);
});

test('表头词当值的脏行被跳过(单位)', () => {
  const dirty: unknown[][] = [['单位', '信息来源'], ['单位', '竞标'], ['真客户', '采购']];
  const { prospects } = parseCustomerRows(dirty);
  assert.ok(!prospects.some((p) => p.name === '单位'), '"单位"不该被当客户');
});

test('认不出表头→诚实标缺不崩', () => {
  const { prospects, missing } = parseCustomerRows([['乱', '七八糟']]);
  assert.equal(prospects.length, 0);
  assert.ok(missing.length > 0);
});
