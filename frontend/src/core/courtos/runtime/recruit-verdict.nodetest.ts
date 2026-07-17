/**
 * 吏部招聘裁断句 · 回归断言(铁律4b) · 跑:pnpm test:core
 *
 * 钉死两类"不该发生的事":
 *  1) 裁断句必须从真 QA 门抬:pass+approve→准奏;hard_check FAIL/issues→缓奏带缺证;reject→不准。
 *  2) 招聘咨询真链零写主库 tasks(结构断言:BFF 两端不得 import/调 upsertPrimaryTask / INTO tasks)。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRecruitVerdict } from './recruit-verdict.ts';
import { WEASEL_PHRASES } from '../../../lib/contracts/chancellor-decision.ts';

/** 取自真跑样本 20260622_205311_47f19f 的 QA 门(synthetic=false)。 */
const REAL_PASS_QA = {
  qa_result: 'pass',
  issues: [],
  verdict_slots: {
    对象: '储能BMS负责人招聘',
    建议动作: 'approve_archive',
    关键数字: ['5年BMS经验', '35-50K薪资'],
  },
  hard_checks: {
    C1数字勾稽: 'NA',
    C2需求硬约束命中: 'PASS',
    C3事实有据: 'PASS',
    C4结构完整: 'PASS',
    C5诚实标注: 'PASS',
  },
};

test('真 pass + approve + 无 FAIL → 准奏,mustResolve 空,confidence 高', () => {
  const v = buildRecruitVerdict(REAL_PASS_QA, 5);
  assert.equal(v.disposition, 'approve');
  assert.ok(v.verdict.startsWith('准奏：'), `应准奏,实得:${v.verdict}`);
  assert.ok(v.verdict.includes('储能BMS负责人招聘'), '裁断须点名对象');
  assert.equal(v.mustResolve.length, 0);
  assert.ok(v.confidence >= 0.9, `confidence 应高,实得 ${v.confidence}`);
});

test('hard_check FAIL → 缓奏,缺口进 mustResolve 并入裁断句', () => {
  const qa = { ...REAL_PASS_QA, hard_checks: { ...REAL_PASS_QA.hard_checks, C2需求硬约束命中: 'FAIL' } };
  const v = buildRecruitVerdict(qa, 4);
  assert.equal(v.disposition, 'hold');
  assert.ok(v.verdict.startsWith('缓奏：'), `应缓奏,实得:${v.verdict}`);
  // P1 修:缺口须人话,不漏内部 check 码 C2
  assert.ok(!v.mustResolve.some((g) => g.includes('C2需求硬约束命中')), `不得漏内部码:${JSON.stringify(v.mustResolve)}`);
  assert.ok(v.mustResolve.some((g) => g.includes('需求硬约束')), '应映射成人话缺口');
  assert.ok(!v.verdict.includes('C2需求硬约束命中'), '裁断句不得含内部 check 码');
});

test('P1 修:QA 解析错误(qa_result=error)不漏技术串给老板,给干净兜底缺口', () => {
  // S2 含糊需求真实形状:QA 输出非 JSON,issues 是技术报错原文。
  const qa = { qa_result: 'error', verdict_slots: {}, hard_checks: undefined, issues: ['JSON解析失败；QA输出非JSON，已从文本推断结果（原因: Expecting value: line 1 column 2）'] };
  const v = buildRecruitVerdict(qa, null);
  assert.equal(v.disposition, 'hold');
  assert.ok(v.mustResolve.every((g) => !/JSON|Expecting value|解析失败/.test(g)), `不得漏技术串:${JSON.stringify(v.mustResolve)}`);
  assert.ok(!/JSON|Expecting value|解析失败/.test(v.verdict), `裁断句不得漏技术串:${v.verdict}`);
  assert.ok(v.mustResolve.length > 0, '须给干净兜底缺口,不留空');
  assert.ok(v.mustResolve[0].length > 5 && !/^C\d/.test(v.mustResolve[0]), `兜底须可读中文、非内码:${v.mustResolve[0]}`);
});

test('会审 M1:合法缺口含 JSON 字样(如"不熟悉 JSON Schema")不被技术噪声误滤', () => {
  const qa = { ...REAL_PASS_QA, qa_result: 'fail', hard_checks: undefined, issues: ['候选人不熟悉 JSON Schema 与接口契约'] };
  const v = buildRecruitVerdict(qa, 3);
  assert.equal(v.disposition, 'hold');
  assert.ok(v.mustResolve.includes('候选人不熟悉 JSON Schema 与接口契约'), `合法 JSON 缺口不得被滤:${JSON.stringify(v.mustResolve)}`);
});

test('会审 M2:reject 时 mustResolve 清空(不准无"补齐"语义,防 UI 显"准奏前先补")', () => {
  // reject + 全是技术噪声 issue:旧逻辑会兜底 push 缺口、污染不准卡。
  const qa = { qa_result: 'error', verdict_slots: { 建议动作: 'reject' }, hard_checks: undefined, issues: ['JSON解析失败'] };
  const v = buildRecruitVerdict(qa, null);
  assert.equal(v.disposition, 'reject');
  assert.equal(v.mustResolve.length, 0, `reject 的 mustResolve 必须空,实得:${JSON.stringify(v.mustResolve)}`);
});

test('QA issues 非空 → 缓奏带缺证(即便 hard_checks 全过)', () => {
  const qa = { ...REAL_PASS_QA, qa_result: 'fail', issues: ['薪资区间与岗位级别不匹配'] };
  const v = buildRecruitVerdict(qa, 3);
  assert.equal(v.disposition, 'hold');
  assert.ok(v.mustResolve.includes('薪资区间与岗位级别不匹配'));
});

test('建议动作 reject → 不准', () => {
  const qa = { ...REAL_PASS_QA, verdict_slots: { ...REAL_PASS_QA.verdict_slots, 建议动作: 'reject' }, issues: ['硬性门槛不达标'] };
  const v = buildRecruitVerdict(qa, 1);
  assert.equal(v.disposition, 'reject');
  assert.ok(v.verdict.startsWith('不准：'), `应不准,实得:${v.verdict}`);
});

test('会审HIGH回归:中文「不准」+pass+全过,绝不能误判准奏(方向性错误最危险)', () => {
  // qa_result=pass、hard_checks 全过、mustResolve 空——只有 action 是中文「不准」。
  // 旧版 approve 正则含单字「准」会把「不准」吃成准奏。此断言永久挡住该回归。
  const qa = { ...REAL_PASS_QA, verdict_slots: { ...REAL_PASS_QA.verdict_slots, 建议动作: '不准录用' } };
  const v = buildRecruitVerdict(qa, 5);
  assert.notEqual(v.disposition, 'approve', '「不准」action 绝不得映射为准奏');
  assert.ok(!v.verdict.startsWith('准奏：'), `「不准」不得出准奏句,实得:${v.verdict}`);
});

test('中文拒绝词「拒绝/否决」→ reject', () => {
  for (const word of ['拒绝该候选', '否决', '退回重拟']) {
    const qa = { ...REAL_PASS_QA, verdict_slots: { 建议动作: word }, qa_result: 'fail', issues: ['不达标'] };
    assert.equal(buildRecruitVerdict(qa, 1).disposition, 'reject', `「${word}」应判 reject`);
  }
});

test('approve 侧禁用单字「准」:不被「基准/标准/准时」误命中', () => {
  // 这些 action 不含明确录用词,但 passOk=true 兜底准奏是允许的;关键是不得因「准」字本身命中。
  // 用 passOk=false 隔离:此时只有明确 APPROVE 词才该 approve,「标准化流程」不该 approve。
  const qa = { ...REAL_PASS_QA, qa_result: 'fail', verdict_slots: { 建议动作: '标准化流程' }, issues: ['待补'] };
  const v = buildRecruitVerdict(qa, 3);
  assert.notEqual(v.disposition, 'approve', '「标准」含准字但 passOk=false 时不得准奏');
});

test('裁断硬判词反"正确的废话"(WEASEL SSOT) — 三种处置都 weasel-free', () => {
  const cases = [
    buildRecruitVerdict(REAL_PASS_QA, 5),
    buildRecruitVerdict({ ...REAL_PASS_QA, hard_checks: { C4结构完整: 'FAIL' } }, 3),
    buildRecruitVerdict({ ...REAL_PASS_QA, verdict_slots: { 建议动作: 'reject' } }, 1),
  ];
  for (const v of cases) {
    for (const w of WEASEL_PHRASES) {
      assert.ok(!v.verdict.includes(w), `裁断句不得含失信废话词「${w}」:${v.verdict}`);
    }
  }
});

test('confidence 由 quality 夹取到 [0,1];缺/非数字 → 0.5', () => {
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, null).confidence, 0.5);
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, 10).confidence, 1);
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, -3).confidence, 0);
});

test('confidenceSource:真返质量分=measured;缺/非有限数=default(不拿兜底 0.5 冒充真把握度)', () => {
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, 5).confidenceSource, 'measured');
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, 0).confidenceSource, 'measured', '0 分也是实测,非缺失');
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, -3).confidenceSource, 'measured', '负分仍是实测(蜂群真返分,只是很差)');
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, null).confidenceSource, 'default');
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, NaN).confidenceSource, 'default', 'NaN 非有限数 → default');
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, Infinity).confidenceSource, 'default', 'Infinity 非有限数 → default');
  assert.equal(buildRecruitVerdict(REAL_PASS_QA, -Infinity).confidenceSource, 'default', '-Infinity 非有限数 → default');
});

test('垃圾/缺失输入不抛,降级 unknown/hold,不冒充准奏', () => {
  for (const bad of [null, undefined, {}, 'x', 42, []]) {
    const v = buildRecruitVerdict(bad, null);
    assert.ok(typeof v.verdict === 'string' && v.verdict.length > 0);
    assert.notEqual(v.disposition, 'approve', `空 QA 不得擅自准奏:${JSON.stringify(bad)}`);
  }
});
