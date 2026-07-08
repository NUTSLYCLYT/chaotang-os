/**
 * 客户验证引擎回归测试。跑：npx --yes tsx --test src/features/bingbu/lib/prospect-qualify.nodetest.ts
 * 钉死两类不变量：① 验证逻辑正确 ② 合法性（无 scraped 来源、永远人扳机、合规旗）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualifyProspect, type IcpProfile, type Prospect } from './prospect-qualify.ts';

const ICP: IcpProfile = {
  industries: ['新能源', '储能'],
  sizeMin: 50,
  sizeMax: 5000,
  signals: ['扩产', '招聘', '换供应商', '新工厂'],
  disqualifiers: ['竞品', '已合作'],
};

function base(overrides: Partial<Prospect>): Prospect {
  return { id: 'p1', name: '某储能公司', source: 'public_business', ...overrides };
}

test('目标客户:行业+信号+规模 → target/高优先', () => {
  const r = qualifyProspect(
    base({ industry: '储能', size: 300, observedSignals: ['扩产', '招聘销售'], contacts: [{ channel: 'email', value: 'a@x.com', consent: true }] }),
    ICP,
  );
  assert.equal(r.verdict, 'target');
  assert.ok(r.matchScore >= 55, `score ${r.matchScore}`);
  assert.equal(r.priority, 'P0'); // 2 信号
  assert.equal(r.industryMatch, true);
});

test('排除项命中 → 直接 not_target，省时间', () => {
  const r = qualifyProspect(base({ industry: '储能', observedSignals: ['竞品转过来的'], size: 300 }), ICP);
  assert.equal(r.verdict, 'not_target');
  assert.match(r.reasons[0], /排除项/);
});

test('负向验证:无行业无信号 → not_target + 说明原因', () => {
  const r = qualifyProspect(base({ industry: '餐饮', size: 10, observedSignals: [] }), ICP);
  assert.equal(r.verdict, 'not_target');
  assert.ok(r.reasons.some((x) => /不匹配|无明确采购信号/.test(x)), '应解释为什么不是');
});

test('合规旗:无联系方式 → 提示合法获取，禁抓取', () => {
  const r = qualifyProspect(base({ industry: '储能', observedSignals: ['扩产'], size: 200 }), ICP);
  assert.ok(r.complianceFlags.some((f) => /禁抓取|合法获取/.test(f)));
});

test('合规旗:有联系方式但未标同意 → 提示勿群发', () => {
  const r = qualifyProspect(
    base({ industry: '储能', observedSignals: ['扩产'], size: 200, contacts: [{ channel: 'wechat', value: 'wx1' }] }),
    ICP,
  );
  assert.ok(r.complianceFlags.some((f) => /勿群发|未标记/.test(f)));
});

test('人扳机:任何目标/待定都只输出 humanActions，无 auto-execute', () => {
  const r = qualifyProspect(
    base({ industry: '储能', size: 300, observedSignals: ['扩产'], contacts: [{ channel: 'email', value: 'a@x.com', consent: true }] }),
    ICP,
  );
  assert.ok(r.humanActions.length > 0);
  assert.ok(r.humanActions.some((a) => /本人|人工|你\/销售/.test(a)), '必须强调人做');
  // 结构性不变量:结果对象里不存在任何 auto/execute/send 字段
  assert.ok(!('autoSend' in r) && !('execute' in r) && !('autoFriend' in r));
});

test('maybe:行业匹配但无信号 → 待定，不硬推', () => {
  const r = qualifyProspect(base({ industry: '新能源', size: 300, observedSignals: [] }), ICP);
  assert.equal(r.verdict, 'maybe');
  assert.match(r.outreachAngle, /时机|破冰|别硬推/);
});
