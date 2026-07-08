import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderClauseReport, clauseReportFilename } from './clause-report.ts';
import { scanWithHistory } from './clause-history.ts';
import type { PastCase } from './reference-class.ts';

const NOW = '2026-06-28T10:00:00.000Z';
const meta = { subject: '供货合同A', generatedAt: NOW };

test('合规报告:veto + 风险条款带法条(吸收自明镜) + 缺证', () => {
  const r = scanWithHistory('乙方承担一切损失并负连带责任;违约金为合同总额百分之五十。', [], NOW);
  const md = renderClauseReport(r, meta);
  assert.match(md, /# 刑部 · 合同合规审查报告/);
  assert.match(md, /不构成法律意见/); // 诚实免责
  assert.match(md, /一票否决/); // veto
  assert.match(md, /民法典/); // ★法条撑腰(吸收自明镜)
  assert.match(md, /缺「责任上限」|缺「争议解决」/); // 缺证
  // ★铁律13.2.3 诚实回归:本地规则引擎绝不标 LIVE(谎报后端验证)
  assert.doesNotMatch(md, /来源[^生]*LIVE/);
  assert.match(md, /本地规则引擎|未经后端/);
});

test('先外后内:史馆同类条款踩坑率进报告', () => {
  const past: PastCase[] = Array.from({ length: 6 }, (_, i) => ({
    id: `h${i}`, summary: '无限责任 连带 赔偿纠纷', outcome: i < 4 ? 'failed' : 'success',
    decidedAt: NOW, confirmed: true,
  }));
  const r = scanWithHistory('乙方承担一切损失并负连带责任。', past, NOW);
  const md = renderClauseReport(r, meta);
  assert.match(md, /外部视角.*史馆/);
  assert.match(md, /出过纠纷|踩坑/);
});

test('文件名', () => {
  assert.equal(clauseReportFilename('供货合同A', NOW), '合规审查报告-供货合同A-2026-06-28.md');
});
