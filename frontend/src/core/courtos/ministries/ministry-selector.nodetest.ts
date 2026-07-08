/** node --experimental-strip-types --test src/core/courtos/ministries/ministry-selector.nodetest.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectMinistries, getDefaultMinistries } from './ministry-selector.ts';

test('合同股权任务 → 选刑部', () => {
  const r = selectMinistries({ originalQuestion: '这个股权合作合同要不要签独家条款' });
  assert.ok(r.selectedMinistries.includes('justice'));
});

test('ROI 报价任务 → 选户部', () => {
  const r = selectMinistries({ originalQuestion: '这个项目的 ROI 和报价能不能回本' });
  assert.ok(r.selectedMinistries.includes('finance'));
});

test('客户招商任务 → 选兵部 + 礼部', () => {
  const r = selectMinistries({ originalQuestion: '这个客户招商合作机会要不要打,话术怎么说' });
  assert.ok(r.selectedMinistries.includes('war'));
  assert.ok(r.selectedMinistries.includes('ritual'));
});

test('BOM 交付任务 → 选工部', () => {
  const r = selectMinistries({ originalQuestion: '储能设备 BOM 和交付验收能不能搞定' });
  assert.ok(r.selectedMinistries.includes('works'));
});

test('90 天推进任务 → 选吏部', () => {
  const r = selectMinistries({ originalQuestion: '这事谁负责,90天里程碑怎么排' });
  assert.ok(r.selectedMinistries.includes('personnel'));
});

test('空/无关输入 → 默认户刑工', () => {
  const r = selectMinistries({ originalQuestion: 'xxxxx' });
  assert.deepEqual(r.selectedMinistries, ['finance', 'justice', 'works']);
  assert.deepEqual(getDefaultMinistries(), ['finance', 'justice', 'works']);
});

test('每个选中部门都有理由', () => {
  const r = selectMinistries({ originalQuestion: '股权合同 + ROI + BOM 交付' });
  for (const id of r.selectedMinistries) assert.ok(r.reasons[id], `${id} 缺理由`);
});
