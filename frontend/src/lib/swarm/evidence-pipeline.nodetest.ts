import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyByRules, classifyEvidence } from './evidence-classify.ts';
import { buildContextForDept } from './source-adapter.ts';
import type { EvidenceRecord } from '@/lib/contracts/evidence';

/* ── 分类器 ── */

test('分类:财报→financial_statement→户部', () => {
  const c = classifyByRules('Q3资产负债表.xlsx', '货币资金 3200万', 'user_uploaded');
  assert.ok(c);
  assert.equal(c.evidenceType, 'financial_statement');
  assert.deepEqual(c.deptAffinity, ['hu_bu']);
  assert.ok(c.confidence >= 0.9);
});

test('分类:合同→刑部', () => {
  const c = classifyByRules('供货协议书.pdf', '违约金条款', 'user_uploaded');
  assert.equal(c?.evidenceType, 'contract');
  assert.deepEqual(c?.deptAffinity, ['xing_bu']);
});

test('分类:未命中规则、无LLM → other(交丞相待确认)', async () => {
  const c = await classifyEvidence('随手记.txt', '今天天气不错', 'user_uploaded');
  assert.equal(c.evidenceType, 'other');
  assert.deepEqual(c.deptAffinity, ['prime_minister']);
});

/* ── SourceAdapter 安全门(Schneier 红线) ── */

function rec(over: Partial<EvidenceRecord> & { trust: EvidenceRecord['classification']['trust']; dept: 'hu_bu' | 'jin_yi_wei' }): EvidenceRecord {
  return {
    id: over.id ?? 'e1',
    uploaderId: 'u1',
    tenantId: 't1',
    uploadedAt: '2026-06-28T00:00:00.000Z',
    filename: over.filename ?? '财报.xlsx',
    insight: over.contentSnippet ?? '货币资金 3200万',
    rawStaysClient: true,
    classification: {
      evidenceType: 'financial_statement',
      deptAffinity: [over.dept],
      trust: over.trust,
      confidence: 0.9,
      rationale: 'test',
    },
  };
}

test('安全门:户部能取到自己的已上传证据,标 real + 含未核标记', () => {
  const ctx = buildContextForDept('hu_bu', [rec({ trust: 'user_uploaded', dept: 'hu_bu' })]);
  assert.equal(ctx.sourceLabel, 'real');
  assert.equal(ctx.hasUnverified, true);
  assert.match(ctx.context, /未核/);
  assert.match(ctx.context, /货币资金 3200万/);
});

test('★Schneier红线:trust=jinyiwei_pending 的脏情报,永不进司上下文', () => {
  const dirty = rec({ id: 'dirty', trust: 'jinyiwei_pending', dept: 'jin_yi_wei', filename: '匿名爆料.txt', contentSnippet: '据说对手要倒闭' });
  const ctx = buildContextForDept('jin_yi_wei', [dirty]);
  assert.equal(ctx.usedIds.length, 0); // 被安全门拦下
  assert.equal(ctx.sourceLabel, 'missing');
  assert.doesNotMatch(ctx.context, /倒闭/);
});

test('安全门:不是本司归属的证据,本司取不到', () => {
  const forHubu = rec({ trust: 'user_uploaded', dept: 'hu_bu' });
  const ctx = buildContextForDept('jin_yi_wei', [forHubu]); // 锦衣卫来取户部的财报
  assert.equal(ctx.usedIds.length, 0);
});
