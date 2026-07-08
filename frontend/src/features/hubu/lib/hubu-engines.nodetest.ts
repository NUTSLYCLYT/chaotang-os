import test from 'node:test';
import assert from 'node:assert/strict';

import type { FinanceRiskLevel, HubuProject } from '../../../lib/contracts/hubu.ts';
import { detectOneWayDoor, evaluateProject, parseRoiMultiple, parseWan, quadrantOf } from './hubu-engines.ts';

function project(over: Partial<HubuProject>): HubuProject {
  return {
    id: 't', title: 't', target_dept: '', owner_dept: '', status: 'pending_review',
    requested_budget: '—', estimated_roi: '—', payback_window: '—', cash_flow_pressure: '—',
    priority: 'P1', risk_level: 'medium' as FinanceRiskLevel, recommendation: '', command: '',
    acceptance_criteria: [], created_at: '', updated_at: '', ...over,
  };
}

test('parseWan / parseRoiMultiple：能解析则真值，不能则 null（不编数字）', () => {
  assert.equal(parseWan('120 万'), 1_200_000);
  assert.equal(parseWan('—'), null);
  assert.equal(parseRoiMultiple('2.3x'), 2.3);
  assert.equal(parseRoiMultiple('22%'), 1.22);
  assert.equal(parseRoiMultiple('—'), null);
});

test('数据全 + 高回报低风险 → 算真值且准奏', () => {
  const ev = evaluateProject(project({ requested_budget: '50 万', estimated_roi: '3x', risk_level: 'low', cash_flow_pressure: '现金充裕' }));
  assert.equal(ev.exposure, 10); // 0.5刻度 × 0.2 × 100
  assert.ok(ev.score !== null && ev.score >= 75);
  assert.equal(ev.verdict, 'approve');
  assert.equal(ev.verdictCn, '准奏');
  assert.equal(ev.missing.length, 0);
});

test('缺 ROI → 显性缺证 + 评分 null + 缓议补证（不静默假装）', () => {
  const ev = evaluateProject(project({ requested_budget: '120 万', estimated_roi: '—' }));
  assert.ok(ev.missing.includes('预期回报/ROI'));
  assert.equal(ev.score, null);
  assert.equal(ev.verdict, 'hold');
  assert.equal(ev.verdictCn, '缓议补证');
  assert.match(ev.explain.roi, /缺证/);
});

test('回报 ≤ 1x → 驳回', () => {
  const ev = evaluateProject(project({ requested_budget: '30 万', estimated_roi: '0.8x', risk_level: 'low' }));
  assert.equal(ev.verdict, 'reject');
});

test('全缺（命令种子常态）→ 三项缺证齐全 + 缓议补证', () => {
  const ev = evaluateProject(project({}));
  for (const gap of ['预算金额', '预期回报/ROI', '现金流影响']) assert.ok(ev.missing.includes(gap), gap);
  assert.equal(ev.verdict, 'hold');
  assert.equal(ev.exposure, null);
});

test('四象限判断力：多样项目正确散到 绿/黄/灰/红（费曼验证）', () => {
  // 高回报(3x)低风险(预算小) → 绿优先投
  assert.equal(quadrantOf(3, 10), 'prefer');
  // 高回报(3x)高风险(敞口>=50) → 黄谨慎
  assert.equal(quadrantOf(3, 60), 'caution');
  // 低回报(1.2x→norm40<50)低风险 → 灰观望
  assert.equal(quadrantOf(1.2, 10), 'watch');
  // 低回报高风险 → 红否决
  assert.equal(quadrantOf(1.2, 80), 'reject');
  // 缺数据 → 不入图(null)，不臆造坐标
  assert.equal(quadrantOf(null, 50), null);
  assert.equal(quadrantOf(2, null), null);
});

test('单向门检测：预付/独家/大额 → 须人工亲裁；普通可逆 → 否', () => {
  assert.ok(detectOneWayDoor(project({ title: '签独家供应合同，预付30万' })).oneWay);
  assert.ok(detectOneWayDoor(project({ requested_budget: '120 万' })).oneWay); // 大额
  assert.ok(detectOneWayDoor(project({ requested_budget: '120 万' })).reasons.includes('大额(≥100万)'));
  assert.equal(detectOneWayDoor(project({ title: '买台能退的打印机', requested_budget: '0.3 万' })).oneWay, false);
});

test('压测·守底线：50万独家大单(预付+独家+现金缺口) → 永远缓议·单向门·现金显形·绝不准奏(Deming)', () => {
  const ev = evaluateProject(project({
    title: '接50万独家大单·30万预付', requested_budget: '30万', estimated_roi: '',
    cash_flow_pressure: '现金只有25万,缺5万付预付', risk_level: 'critical', priority: 'P0',
  }));
  assert.notEqual(ev.verdict, 'approve', '会害死人的危险单：绝不准奏');
  assert.equal(ev.oneWayDoor.oneWay, true, '预付+独家 = 单向门必拦');
  assert.equal(ev.cashStress, true, '现金缺口必须显形(不埋文本)');
  assert.ok(ev.cashNote?.includes('缺5万'), 'cashNote 带现金缺口原文');
});

test('质检/防幻觉显形：缺信息→标缺不编；全给→3项有据', () => {
  const thin = evaluateProject(project({ title: '接个50万大单要不要' })); // 全缺
  assert.equal(thin.quality.missing, 3, '预算/回报/现金 三项全缺');
  assert.equal(thin.quality.grounded, 0);
  assert.equal(thin.score, null, '缺则评分 null，绝不编一个糊弄');
  const full = evaluateProject(project({ requested_budget: '8万', estimated_roi: '2.6x', cash_flow_pressure: '现金充裕' }));
  assert.equal(full.quality.grounded, 3, '三项全给 → 3 项有据');
  assert.equal(full.cashStress, false, '现金充裕 ≠ 现金压力');
});
