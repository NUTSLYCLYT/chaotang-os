import assert from 'node:assert/strict';
import test from 'node:test';

import { gateLegalField, classifyLegalOutput } from './legal-consequence.ts';

test('命门: 后果性字段(核心条款建议/法务决策建议)禁一键采纳', () => {
  const g = gateLegalField('核心条款建议', '建议把账期改为60天');
  assert.equal(g.humanConfirmationRequired, true, '后果白名单字段必须需人工确认');
  assert.notEqual(g.blastRadius, 'internal');
});

test('命门 fail-secure: 即便字段名是"风险识别清单",命中高危词(违约金/独家)仍升级为锁', () => {
  const g = gateLegalField('风险识别清单', '对方要求独家供货2年,违约金为合同额30%');
  assert.equal(g.humanConfirmationRequired, true, '内容级高危词命中→锁,不被字段名绕过');
  assert.ok(g.triggers.some((t) => t.includes('违约金') || t.includes('独家')));
});

test('命门: 含诉讼/签署等不可逆动作 → blastRadius=irreversible', () => {
  const g = gateLegalField('争议与执行方案', '建议立即向法院起诉并申请财产保全');
  assert.equal(g.blastRadius, 'irreversible', '诉讼=不可逆对外动作');
  assert.equal(g.humanConfirmationRequired, true);
});

test('命门: fail-secure 倾向——含"仲裁"的字段宁可多锁', () => {
  const g = gateLegalField('合同背景与适用法域', '本合同适用中国大陆法律,争议提交北京仲裁');
  assert.equal(g.humanConfirmationRequired, true, 'fail-secure:含仲裁→锁,宁可多锁让老板手动开');
});

test('classifyLegalOutput: 后果性字段进 consequentialFields(body仍带),定性进 consult,worst-wins 折叠', () => {
  const fo = {
    合同背景与适用法域: '储能PACK代工合同,适用中国法',
    风险识别清单: '账期偏长,需关注现金流',
    核心条款建议: '违约金30%过高,建议降至10%;知识产权归属须改为共有',
    法务决策建议: '建议谈判后签署,不可现状签',
  };
  const r = classifyLegalOutput(fo);
  assert.ok('合同背景与适用法域' in r.consult);
  assert.ok('风险识别清单' in r.consult);
  const fields = r.consequentialFields.map((c) => c.field);
  assert.ok(fields.includes('核心条款建议'));
  assert.ok(fields.includes('法务决策建议'));
  const clause = r.consequentialFields.find((c) => c.field === '核心条款建议');
  assert.ok(clause && clause.body.includes('违约金'), '后果字段 body 不剥离(可读),只标需确认');
  assert.equal(r.humanConfirmationRequired, true);
  assert.equal(r.blastRadius, 'irreversible');
  assert.equal(r.consult['核心条款建议'], undefined);
});

test('classifyLegalOutput: 空/异常输入 → 安全空壳', () => {
  const r = classifyLegalOutput(null);
  assert.equal(r.humanConfirmationRequired, false);
  assert.deepEqual(r.consequentialFields, []);
});
