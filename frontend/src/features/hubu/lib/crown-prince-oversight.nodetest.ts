/**
 * 监国 · 全程监控 + 即时褫夺 + 废因归史(测试)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { watchLiveDecision, runOversightSession, buildDethroneArchive } from './crown-prince-oversight.ts';
import type { CrownPrinceCaseRecord } from './crown-prince-track-record.ts';

function rec(over: Partial<CrownPrinceCaseRecord> = {}): CrownPrinceCaseRecord {
  return {
    caseId: 'c', riskClass: 'reversible', highStakes: false, outcome: 'matched',
    predictionConfidence: 'medium', concededWhenOverruled: true,
    yushiEvidenceFabricated: false, qintianRuinMissed: false,
    irreversibleMisApproved: false, jinyiweiAnomaly: false, ...over,
  };
}

test('干净决策 → 放行,不褫夺', () => {
  const v = watchLiveDecision(rec({ caseId: 'ok' }));
  assert.equal(v.allowed, true);
  assert.equal(v.deposed, false);
  assert.equal(v.fatalWatcher, null);
});

test('死法漏判 → 当场拦 + 即时褫夺(钦天监落锤)', () => {
  const v = watchLiveDecision(rec({ caseId: 'ruin', qintianRuinMissed: true }));
  assert.equal(v.allowed, false);
  assert.equal(v.deposed, true);
  assert.equal(v.fatalWatcher, 'qintian');
});

test('证据造假 → 御史落锤褫夺', () => {
  const v = watchLiveDecision(rec({ yushiEvidenceFabricated: true }));
  assert.equal(v.deposed, true);
  assert.equal(v.fatalWatcher, 'yushi');
});

test('作弊异动 → 锦衣卫落锤褫夺', () => {
  const v = watchLiveDecision(rec({ jinyiweiAnomaly: true }));
  assert.equal(v.deposed, true);
  assert.equal(v.fatalWatcher, 'jinyiwei');
});

test('丞相回避:高信心错判只预警,不独自褫夺', () => {
  const v = watchLiveDecision(rec({ predictionConfidence: 'high', outcome: 'mismatched' }));
  assert.equal(v.deposed, false, '丞相是保荐人,不能独自落锤');
  assert.ok(v.chancellorWarning, '但必须留预警痕');
  assert.equal(v.fatalWatcher, null);
});

test('废因归史:致命褫夺产出对齐教材', () => {
  const v = watchLiveDecision(rec({ caseId: 'ruin-1', qintianRuinMissed: true }));
  const arc = buildDethroneArchive(v);
  assert.ok(arc);
  assert.equal(arc!.kind, 'crown_prince_dethrone');
  assert.equal(arc!.watcherCn, '钦天监');
  assert.match(arc!.lessonForNext, /死法红线/);
  assert.equal(arc!.sourceLabel, 'LIVE');
});

test('放行决策无废因归史(null)', () => {
  assert.equal(buildDethroneArchive(watchLiveDecision(rec())), null);
});

test('全程监控会话:首个致命即停,之后全不放行(kill switch)', () => {
  const stream = [
    rec({ caseId: 's1' }),
    rec({ caseId: 's2' }),
    rec({ caseId: 's3-fatal', irreversibleMisApproved: true }),
    rec({ caseId: 's4' }), // 已褫夺,不该再放行
    rec({ caseId: 's5' }),
  ];
  const r = runOversightSession(stream);
  assert.equal(r.deposed, true);
  assert.equal(r.deposedAtCaseId, 's3-fatal');
  assert.equal(r.allowedCount, 2, '只放行了 fatal 之前的 2 条');
  assert.ok(r.dethroneArchive, '产出废因归史');
});

test('全清流 → 全程放行,无褫夺,无废因', () => {
  const r = runOversightSession([rec({ caseId: 'a' }), rec({ caseId: 'b' }), rec({ caseId: 'c' })]);
  assert.equal(r.deposed, false);
  assert.equal(r.allowedCount, 3);
  assert.equal(r.dethroneArchive, null);
});

test('监国会话打印 · 演示流', () => {
  const stream = [
    rec({ caseId: 'live-1' }),
    rec({ caseId: 'live-2', predictionConfidence: 'high', outcome: 'mismatched' }), // 丞相预警但放行
    rec({ caseId: 'live-3', qintianRuinMissed: true }), // 致命,停
  ];
  const r = runOversightSession(stream);
  console.log(`\n  ── 监国全程监控(演示流)──`);
  console.log(`  共 ${r.total} 条自治决策 · 放行 ${r.allowedCount} · 褫夺 ${r.deposed ? `是(止于 ${r.deposedAtCaseId})` : '否'}`);
  if (r.chancellorWarnings.length) console.log(`  丞相预警:${r.chancellorWarnings.join(' ; ')}`);
  if (r.dethroneArchive) console.log(`  废因归史:[${r.dethroneArchive.watcherCn}] ${r.dethroneArchive.reason} → 教材:${r.dethroneArchive.lessonForNext}`);
  console.log(`  注:framework 已就绪,太子册封上线(就绪度→100%)前休眠,不拦真实流量。`);
  assert.equal(r.deposed, true);
});
