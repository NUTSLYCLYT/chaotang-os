import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractBatterySpec, toSpecEvidence } from './gongbu-spec-ingest.ts';

// 代表性规格书文本(模拟客户端解析 PDF/docx 后的文本)
const SPEC_TEXT = `
锂离子电池产品规格书 B1版
型号:INR21700-55P
额定容量:5500mAh
标称电压:3.7V
工作温度:-20°C ~ 60°C
循环寿命:≥800次
`;

test('从规格文本抽脱敏洞见(关键字段)', () => {
  const ins = extractBatterySpec(SPEC_TEXT);
  assert.equal(ins.model, 'INR21700-55P');
  assert.match(ins.capacity ?? '', /5500mAh/);
  assert.match(ins.voltage ?? '', /3.7\s*V/);
  assert.match(ins.tempRange ?? '', /-20.*60/);
  assert.ok(ins.fieldsFound >= 4);
  assert.match(ins.summary, /型号 INR21700-55P/);
});

test('诚实:摘要只含结构化字段,不回吐全文', () => {
  const ins = extractBatterySpec(SPEC_TEXT);
  assert.ok(!ins.summary.includes('产品规格书 B1版')); // 不含原文标题等
  assert.ok(ins.summary.length < 120);
});

test('抽不到 → 诚实标缺,不编', () => {
  const ins = extractBatterySpec('这是一段无关文本,讲天气。');
  assert.equal(ins.fieldsFound, 0);
  assert.match(ins.summary, /未抽到|人工核/);
});

test('洞见→spec证据:原文不上云(rawStaysClient)+ insight仅摘要', () => {
  const ins = extractBatterySpec(SPEC_TEXT);
  const ev = toSpecEvidence(ins, { id: 'e1', filename: 'INR21700规格书.pdf', tenantId: 't1', uploaderId: 'u1', uploadedAt: '2026-06-29T00:00:00.000Z' });
  assert.equal(ev.rawStaysClient, true);
  assert.equal(ev.classification.evidenceType, 'spec');
  assert.deepEqual(ev.classification.deptAffinity, ['gong_bu']);
  assert.equal(ev.insight, ins.summary); // 只存脱敏摘要
  assert.ok(ev.classification.confidence >= 0.8); // 4-5字段→高置信
});
