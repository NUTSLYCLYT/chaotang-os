import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTalent, rankTalent } from './talent-search.ts';
const REQ = { role: 'BMS工程师', mustHave: ['BMS', '锂电', '嵌入式'], niceToHave: ['军工', 'AFE'], minYears: 3 };
test('硬性全中+年限够→强匹配', () => {
  const r = matchTalent({ name: '甲', skills: ['BMS开发', '锂电池', '嵌入式C'], yearsExp: 5, source: 'jinyiwei_search' }, REQ);
  assert.equal(r.verdict, 'strong_fit');
  assert.equal(r.gaps.length, 0);
});
test('缺硬性→弱/待定 + 缺口显性', () => {
  const r = matchTalent({ name: '乙', skills: ['java', '后端'], yearsExp: 5, source: 'upload' }, REQ);
  assert.equal(r.verdict, 'weak');
  assert.ok(r.gaps.length >= 2);
});
test('合规旗:无联系方式/在职竞业/背调人工', () => {
  const r = matchTalent({ name: '丙', skills: ['BMS', '锂电', '嵌入式'], yearsExp: 4, currentCompany: '某竞品', source: 'jinyiwei_search' }, REQ);
  assert.ok(r.compliance.some((c) => c.includes('竞业')));
  assert.ok(r.compliance.some((c) => c.includes('背景调查') || c.includes('背调') || c.includes('人工')));
});
test('批量猎才按匹配度排序', () => {
  const ranked = rankTalent([
    { name: '弱', skills: ['java'], yearsExp: 2, source: 'upload' },
    { name: '强', skills: ['BMS', '锂电', '嵌入式', '军工'], yearsExp: 6, source: 'jinyiwei_search' },
  ], REQ);
  assert.equal(ranked[0].candidate, '强');
});
