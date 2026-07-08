import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyDelivery, evaluateTask, forbiddenCommitments, productionLocks, type GongbuTask } from './gongbu-engines.ts';

function task(over: Partial<GongbuTask>): GongbuTask {
  return { id: 't', taskId: 't', title: '', description: '', rawCommand: '', status: 'running', progressPct: 0, ...over };
}

test('产线资产锁（铁律9）：成本/BOM/交期 → 上锁；纯技术 → 无锁', () => {
  assert.deepEqual(productionLocks('这个储能PACK的BOM和成本怎么样').sort(), ['BOM', '成本'].sort());
  assert.ok(productionLocks('交期能压到30天吗').includes('交期'));
  assert.equal(productionLocks('这个登录页架构怎么设计').length, 0);
});

test('分类：按关键词命中交付问题类型', () => {
  assert.equal(classifyDelivery('技术上可行吗，架构怎么选型'), 'TECHNICAL_FEASIBILITY');
  assert.equal(classifyDelivery('先切个 MVP 砍掉非核心'), 'MVP_SCOPE');
  assert.equal(classifyDelivery('BOM 和供应商有没有替代'), 'BOM_SUPPLY_CHAIN');
  assert.equal(classifyDelivery('随便写点啥'), 'OTHER_DELIVERY_RISK');
});

test('对外承诺 → 须人工亲裁（不可逆尾部风险）', () => {
  assert.ok(forbiddenCommitments('要不要对外承诺这个交期').length > 0);
  assert.equal(forbiddenCommitments('内部排个工期').length, 0);
});

test('裁决：触产线/对外承诺→复核；已交付→准奏；普通→削MVP', () => {
  assert.equal(evaluateTask(task({ title: '储能项目成本和交期' })).verdict, 'review');
  assert.equal(evaluateTask(task({ title: '对外承诺客户30天交付' })).verdict, 'review');
  assert.equal(evaluateTask(task({ title: '做个登录页', status: 'archived' })).verdict, 'approve');
  assert.equal(evaluateTask(task({ title: '做个登录页', status: 'running' })).verdict, 'amend');
});

test('跨部会审：命中成本→拉户部，合同→拉刑部', () => {
  const ev = evaluateTask(task({ title: '这个合同里的成本条款' }));
  const depts = ev.cross.map((c) => c.cn);
  assert.ok(depts.includes('户部') && depts.includes('刑部'));
});