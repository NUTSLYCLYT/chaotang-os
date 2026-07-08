/**
 * 工部双脑收口 · 回归钉子(铁律6 · 2026-07-01)
 *
 * 收口前:页面脑 classifyDelivery(自带平行关键词表)与 合奏脑 classifyGongbuDeliveryQuestion
 *   对同一任务给不同类型(如「固定交期承诺」页面判 SCHEDULE、合奏判 DELIVERY_COMMITMENT)→ 卷轴与丞相口径打架。
 * 收口后:页面脑委托合奏脑,二者对任意输入恒等。此测钉死这个不变量——谁再加平行表即红。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyDelivery } from './gongbu-engines.ts';
import { classifyGongbuDeliveryQuestion } from '../../../core/courtos/gongbu/gongbu-cto-cpo-office.ts';

const CASES: string[] = [
  '客户要求30天固定交期,一定按时交付',
  '这个储能冷库硬件项目怎么施工',
  'BOM 供应商替代料采购库存',
  '技术方案架构可行性怎么评',
  '验收测试 SLA 稳定性上线',
  '现场部署并网安装安全',
  'MVP 第一版范围先做哪些',
  '加需求变更范围',
  '延期复盘下次怎么避免',
  '分析低温电池市场',
  '',
];

test('收口不变量:页面脑分类 === 合奏脑分类(任意输入)', () => {
  for (const t of CASES) {
    assert.equal(
      classifyDelivery(t),
      classifyGongbuDeliveryQuestion(t),
      `双脑对「${t}」分类不一致 → 又漂移了`,
    );
  }
});

test('漂移案已消:「固定交期承诺」两脑都判 DELIVERY_COMMITMENT(承诺优先·高风险不漏)', () => {
  const t = '客户要求30天固定交期,一定按时交付';
  assert.equal(classifyGongbuDeliveryQuestion(t), 'DELIVERY_COMMITMENT');
  assert.equal(classifyDelivery(t), 'DELIVERY_COMMITMENT');
});

test('确定性:同输入两次一致', () => {
  assert.equal(classifyDelivery('BOM 采购'), classifyDelivery('BOM 采购'));
});
