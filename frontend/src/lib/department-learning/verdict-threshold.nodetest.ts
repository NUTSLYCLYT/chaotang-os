/** node --experimental-strip-types --test src/lib/department-learning/verdict-threshold.nodetest.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveThresholdedVerdict, MIN_SAMPLES_FOR_VERDICT } from './verdict-threshold.ts';

// ── 样本量闸门回归(2026-07-03 P2修)：DEPARTMENT_LEARNING_FEED_DECISIONS 默认关时留下的
// 真正根因——此前"最近一次事件直接覆盖判定"，一次签核+归档就能把某部门权重从中性甩到
// 1.15/0.5。这里钉死"过阈值前强制 observing + 过阈值后看累计多数票"这条闸门。

test(`单次confirmed事件不改判(仍是observing)，累计计数递增(阈值=${MIN_SAMPLES_FOR_VERDICT})`, () => {
  const result = deriveThresholdedVerdict(0, 0, 'confirmed');
  assert.equal(result.confirmedCount, 1);
  assert.equal(result.refutedCount, 0);
  assert.equal(result.verdict, 'observing', '单次事件不足以过样本量闸门，必须仍是 observing');
});

test('累计到阈值前每一步都仍是observing，到阈值那一步才真正变成confirmed', () => {
  let confirmed = 0;
  let refuted = 0;
  for (let i = 1; i <= MIN_SAMPLES_FOR_VERDICT; i += 1) {
    const result = deriveThresholdedVerdict(confirmed, refuted, 'confirmed');
    confirmed = result.confirmedCount;
    refuted = result.refutedCount;
    if (i < MIN_SAMPLES_FOR_VERDICT) {
      assert.equal(result.verdict, 'observing', `第${i}次仍应observing(未过阈值${MIN_SAMPLES_FOR_VERDICT})`);
    } else {
      assert.equal(result.verdict, 'confirmed', `第${i}次达到阈值，应真正过闸变成confirmed`);
    }
  }
  assert.equal(confirmed, MIN_SAMPLES_FOR_VERDICT);
});

test('累计到阈值前每一步都仍是observing，到阈值那一步才真正变成refuted(对称性)', () => {
  let confirmed = 0;
  let refuted = 0;
  for (let i = 1; i <= MIN_SAMPLES_FOR_VERDICT; i += 1) {
    const result = deriveThresholdedVerdict(confirmed, refuted, 'refuted');
    confirmed = result.confirmedCount;
    refuted = result.refutedCount;
    if (i < MIN_SAMPLES_FOR_VERDICT) {
      assert.equal(result.verdict, 'observing');
    } else {
      assert.equal(result.verdict, 'refuted');
    }
  }
});

test('confirmed与refuted累计打平时，即使过了阈值也判observing(不偏向任何一边)', () => {
  // 2 confirmed + 2 refuted = 4 总样本，已过阈值(3)，但1:1打平。
  const result = deriveThresholdedVerdict(2, 2, null);
  assert.equal(result.confirmedCount, 2);
  assert.equal(result.refutedCount, 2);
  assert.equal(result.verdict, 'observing', '打平不该偏向confirmed，必须observing');
});

test('thisRoundOutcome=null(单证据/史馆未归档)不计入累计，恒observing', () => {
  const result = deriveThresholdedVerdict(5, 0, null);
  assert.equal(result.confirmedCount, 5, '不计入本轮，保持原值');
  assert.equal(result.refutedCount, 0);
  assert.equal(result.verdict, 'observing', '单证据(null)一律observing，即便历史样本已过阈值');
});

test('净胜局数(margin)达标才判confirmed/refuted，够样本数不等于够信号', () => {
  // 3 confirmed vs 2 refuted，总5>=阈值，但margin=1<2——够样本数不够净胜局，仍应observing。
  const thinMargin = deriveThresholdedVerdict(2, 2, 'confirmed');
  assert.equal(thinMargin.verdict, 'observing', 'margin=1时即便样本数够，也不该下判断(2-1这种勉强多数在纯噪声下太常见)');
  // 4 confirmed vs 2 refuted，margin=2，够格。
  const majorityConfirmed = deriveThresholdedVerdict(3, 2, 'confirmed');
  assert.equal(majorityConfirmed.verdict, 'confirmed', 'margin=2达标应真正判confirmed');
  // 2 confirmed vs 4 refuted，margin=2，够格偏refuted。
  const majorityRefuted = deriveThresholdedVerdict(2, 3, 'refuted');
  assert.equal(majorityRefuted.verdict, 'refuted', 'margin=2达标应真正判refuted');
});

test('核心场景: 刚好n=3的2-1"勉强多数"必须observing——此前(仅要求多数)会误判confirmed', () => {
  // n=3是奇数，永远不可能打平，2-1这种margin=1的"多数"在纯随机噪声下发生概率是100%。
  // 这正是本次(2026-07-03 P2追加)margin改动要堵的洞：samples够阈值≠信号够可信。
  const result = deriveThresholdedVerdict(1, 1, 'confirmed'); // → 2 confirmed, 1 refuted, margin=1
  assert.equal(result.confirmedCount, 2);
  assert.equal(result.refutedCount, 1);
  assert.equal(result.verdict, 'observing', 'n=3的2-1勉强多数(margin=1)不该被当作可信信号');
});
