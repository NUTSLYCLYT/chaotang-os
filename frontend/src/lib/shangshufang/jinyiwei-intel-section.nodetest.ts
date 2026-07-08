/**
 * 铁律4 回归断言：锦衣卫采证段必须诚实挂进回奏，缺证不得伪装成有证。
 * 钉的"不该发生的事"：情报库空时采证段冒充有证据、或采证段根本没挂上卷轴。
 * 跑：node --test --experimental-strip-types src/lib/shangshufang/jinyiwei-intel-section.nodetest.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import type { ShangshufangReviewMemorial } from '../jiqun-api.ts';
import { attachJinyiweiIntelSection } from './jinyiwei-intel-section.ts';

function baseMemorial(): ShangshufangReviewMemorial {
  return {
    task_id: 't1',
    title: '户部回奏',
    verdict: '待裁',
    summary: '',
    ministry_outputs: [{ department: '户部', focus: '核算', opinion: 'x', status: 'ok', source_label: 'MIXED' }],
    quality_gate: { status: 'pending', reasons: [], human_signoff_required: false },
    conflict_summary: [],
    evidence_gaps: [],
    risk_flags: [],
    decision_options: [],
    next_best_action: 'archive',
    source_label: 'MIXED',
  };
}

test('有情报：采证段挂上锦衣卫部门 + 情报进证据链，且源与信封一致', () => {
  const m = attachJinyiweiIntelSection(baseMemorial(), {
    tavilyCitations: [{ url: 'u', title: '铭硕新能2026Q2财报', snippet: '税负率18%' }],
  });
  const jyw = m.department_memorials?.find((d) => d.department_id === '锦衣卫');
  assert.ok(jyw, '锦衣卫采证段必须挂进 department_memorials');
  assert.equal(jyw?.verdict, 'APPROVE');
  assert.equal(m.evidence_chain?.length, 1, '采得情报必须进证据链');
  assert.equal(m.evidence_chain?.[0].source_label, 'MIXED', '采证段源必须继承信封源(不破全字段同源不变量)');
  assert.ok(m.ministry_outputs.some((o) => o.department === '锦衣卫' && o.status === '已采证'));
  // 户部原回奏不能被吞
  assert.ok(m.ministry_outputs.some((o) => o.department === '户部'));
});

test('无情报(诚实缺证)：不得伪装有证，必须标缺证进 missing_evidence', () => {
  const m = attachJinyiweiIntelSection(baseMemorial(), { tavilyCitations: [] });
  const jyw = m.department_memorials?.find((d) => d.department_id === '锦衣卫');
  assert.equal(jyw?.signal, 'GRAY', '无情报锦衣卫信号必须灰,不得绿');
  assert.equal(jyw?.verdict, 'NEED_EVIDENCE');
  assert.equal(m.evidence_chain?.length ?? 0, 0, '无情报不得凭空造证据链');
  assert.ok(
    (m.missing_evidence ?? []).some((x) => x.includes('采证')),
    '缺证必须诚实写进 missing_evidence',
  );
  assert.ok(m.ministry_outputs.some((o) => o.department === '锦衣卫' && o.status === '缺证'));
});

test('不可变：不改入参 memorial', () => {
  const base = baseMemorial();
  const before = base.ministry_outputs.length;
  attachJinyiweiIntelSection(base, { tavilyCitations: [{ title: 'x' }] });
  assert.equal(base.ministry_outputs.length, before, '原 memorial 不得被 mutate');
  assert.equal(base.department_memorials, undefined);
});
