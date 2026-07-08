import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scanWithHistory } from './clause-history.ts';
import type { PastCase } from './reference-class.ts';

const NOW = '2026-06-28T00:00:00.000Z';
function c(id: string, summary: string, outcome: PastCase['outcome'], daysAgo = 30): PastCase {
  return { id, summary, outcome, decidedAt: new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString(), confirmed: true };
}

test('先外后内:最高危条款 + 史馆同类踩坑 base rate', () => {
  // 6 条含"无限责任"的旧合同,多数踩坑(failed/blocked)
  const past = [
    c('h1', '采购合同 无限责任 连带 赔偿纠纷', 'failed'),
    c('h2', '无限责任 连带 赔偿 被诉', 'failed'),
    c('h3', '无限责任 连带 履约', 'blocked'),
    c('h4', '含无限责任连带条款 赔偿', 'failed'),
    c('h5', '无限责任 连带 顺利', 'success'),
    c('h6', '无限责任 赔偿 连带', 'failed'),
    c('x1', '员工绩效 调薪 无关', 'success'),
  ];
  const r = scanWithHistory('乙方承担一切损失并负连带责任。', past, NOW);
  assert.equal(r.topRiskType, 'unlimited_liability');
  assert.ok(r.topRiskHistory);
  assert.equal(r.topRiskHistory.mode, 'base_rate'); // ≥5 同类
  // 踩坑(failed)应占多数
  assert.ok((r.topRiskHistory.distribution.failed ?? 0) > (r.topRiskHistory.distribution.success ?? 0));
  assert.ok(!r.topRiskHistory.usedCaseIds.includes('x1')); // 无关案不进
});

test('样本不足:史馆同类案<5 → 只给类比不给假踩坑率', () => {
  const past = [c('h1', '无限责任 连带 赔偿', 'failed'), c('h2', '无限责任 连带', 'failed')];
  const r = scanWithHistory('乙方承担一切损失并负连带责任。', past, NOW);
  assert.equal(r.topRiskHistory?.mode, 'analogy_only');
  assert.deepEqual(r.topRiskHistory?.distribution, {});
});

test('无风险条款 → 无历史查询', () => {
  const r = scanWithHistory('双方协商解除。验收合格付款。争议仲裁。责任以合同金额为限。保密。', [], NOW);
  assert.equal(r.topRiskType, null);
  assert.equal(r.topRiskHistory, null);
});
