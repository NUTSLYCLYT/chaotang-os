import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scanClauses } from './clause-risk.ts';

test('高危合同:无限责任+单方解除 → veto(一票否决)', () => {
  const r = scanClauses(
    '乙方承担一切损失并负连带责任;甲方有权随时解除本合同。违约金为合同总额的百分之五十。',
  );
  const types = r.risks.map((x) => x.type);
  assert.ok(types.includes('unlimited_liability'));
  assert.ok(types.includes('unilateral'));
  assert.ok(r.risks.filter((x) => x.severity === 'high').length >= 2);
  assert.equal(r.verdict, 'veto');
  assert.ok(r.riskScore >= 60);
});

test('缺标准保护条款被揪出(缺证)', () => {
  const r = scanClauses('本协议自动续约,期限一年。'); // 无验收/争议/责任上限/保密
  const missingWhat = r.missing.map((m) => m.what);
  assert.ok(missingWhat.includes('验收/质量标准'));
  assert.ok(missingWhat.includes('争议解决'));
  assert.ok(missingWhat.includes('责任上限'));
  // auto_renew 也该命中
  assert.ok(r.risks.some((x) => x.type === 'auto_renew'));
});

test('干净合同:无高危 + 保护齐备 → pass,且仍提示人工终审', () => {
  const r = scanClauses(
    '双方协商解除。验收标准见附件,质量合格后付款。争议提交仲裁解决。乙方责任以合同金额为限。双方保密。',
  );
  assert.equal(r.risks.filter((x) => x.severity === 'high').length, 0);
  assert.equal(r.missing.length, 0);
  assert.equal(r.verdict, 'pass');
  assert.match(r.rationale, /人工终审|不替代法律意见/);
});

test('捞自明镜:最终解释权归对方 → final_interpretation(高危·带民法典498)', () => {
  const r = scanClauses('本活动最终解释权归本公司所有。');
  const hit = r.risks.find((x) => x.type === 'final_interpretation');
  assert.ok(hit);
  assert.equal(hit.severity, 'high');
  assert.match(hit.legalBasis ?? '', /498/);
});

test('诚实:结果只产脱敏条款片段,不含全文(snippet 短)', () => {
  const long = '前言'.repeat(50) + '乙方承担一切损失' + '后续'.repeat(50);
  const r = scanClauses(long);
  const hit = r.risks.find((x) => x.type === 'unlimited_liability');
  assert.ok(hit);
  assert.ok(hit.snippet.length <= 60); // 只截命中条款附近,不回吐全文
});
