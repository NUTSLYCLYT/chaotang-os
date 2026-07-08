import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderReport, reportFilename, type DeliverableMeta } from './deliverable.ts';
import type { AgentResult } from './dept-agent.ts';

function baseResult(over: Partial<AgentResult> = {}): AgentResult {
  return {
    answer: '建议持有,目标价 120 元',
    reasoning: '基于 PE 18 与行业均值对标',
    evidence: ['货币资金 3200 万', '应收 1800 万'],
    assumptions: [],
    conflicts: '需刑部复核合规',
    confidence: 0.82,
    grounding: { total: 3, grounded: 3, rate: 1, ungrounded: [] } as AgentResult['grounding'],
    evidenceBinding: { total: 0, grounded: 0, rate: 1, ungrounded: [] } as AgentResult['evidenceBinding'],
    reprompted: false,
    grounded: true,
    model: 'test-model',
    latencyMs: 10,
    ...over,
  };
}

const meta: DeliverableMeta = {
  deptNameCn: '户部',
  command: '这只股票该不该买',
  sourceLabel: 'LIVE',
  generatedAt: '2026-06-28T10:00:00.000Z',
};

test('grounded 报告:含裁断/证据/把握度 + ✅ 已校验,标 LIVE', () => {
  const md = renderReport(baseResult(), meta);
  assert.match(md, /# 户部 · 研判报告/);
  assert.match(md, /✅ 数字接地校验通过/);
  assert.match(md, /\*\*LIVE\*\*/);
  assert.match(md, /## 裁断/);
  assert.match(md, /目标价 120 元/);
  assert.match(md, /## 证据/);
  assert.match(md, /货币资金 3200 万/);
  assert.match(md, /82%/);
});

test('铁律红线:降级稿(grounded=false)绝不冒充已校验,且列出未接地数字', () => {
  const degraded = baseResult({
    grounded: false,
    grounding: {
      total: 3,
      grounded: 2,
      rate: 0.66,
      ungrounded: [{ raw: '999 万' } as never],
    } as AgentResult['grounding'],
  });
  const md = renderReport(degraded, { ...meta, sourceLabel: 'FALLBACK' });
  // 必须明标降级,且不得出现"已校验通过"字样
  assert.match(md, /⚠️ \*\*降级稿\*\*/);
  assert.match(md, /999 万/);
  assert.doesNotMatch(md, /✅ 数字接地校验通过/);
  assert.match(md, /\*\*FALLBACK\*\*/);
});

test('文件名含司名与日期', () => {
  assert.equal(reportFilename('户部', '2026-06-28T10:00:00.000Z'), '户部研判报告-2026-06-28.md');
});
