import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEvidenceBoundSwarmRun,
  buildPackIntelligencePack,
  extractEvidenceBindingFromSession,
} from './evidence-bound-swarm-run.ts';
import { buildFeasibilityEnvelope } from './gongbu-feasibility-envelope.ts';

test('buildPackIntelligencePack marks PACK input as evidence-bound MIXED intelligence', () => {
  const pack = buildPackIntelligencePack(
    '冷库低温 PACK 研发，要求评估报价、BOM、供应商、交期和量产可行性',
  );

  assert.equal(pack.schema_version, 'JinyiweiEvidencePackForSwarmV1');
  assert.equal(pack.departmentId, 'jinyiwei');
  assert.equal(pack.sourceLabel, 'MIXED');
  assert.ok(pack.packId.startsWith('jinyiwei_pack_rd_'));
  assert.ok(pack.evidenceRefs.some((ref) => ref.claimType === 'CLAIM'));
  assert.ok(pack.missingEvidence.some((item) => item.includes('报价/成本/预算')));
  assert.ok(pack.missingEvidence.some((item) => item.includes('工况曲线')));
  assert.ok(pack.missingEvidence.some((item) => item.includes('PACK验收标准')));
  assert.ok(pack.unsupportedClaims.some((item) => item.includes('不得升级为对外承诺')));
  assert.ok(pack.forbiddenOutputs.includes('正式报价'));
  assert.ok(pack.qualityGates.includes('production_assets_must_be_locked'));
});

test('buildEvidenceBoundSwarmRun emits backend-compatible pack_rd payload fields', () => {
  const bound = buildEvidenceBoundSwarmRun({
    taskInput: 'PACK 低温方案，需要成本预算，但没有报价单',
    entrySwarm: 'pack_rd',
    evidenceRefs: ['客户口头需求截图'],
    missingEvidence: ['客户验收边界未确认'],
  });

  assert.equal(bound.schema_version, 'EvidenceBoundSwarmRunV1');
  assert.equal(bound.entry_swarm, 'pack_rd');
  assert.equal(bound.task_input, 'PACK 低温方案，需要成本预算，但没有报价单');
  assert.equal(bound.intelligence_pack_id, bound.intelligence_pack.packId);
  assert.ok(bound.evidence_refs.length >= 1);
  assert.ok(bound.missing_evidence.includes('客户验收边界未确认'));
  assert.ok(bound.forbidden_outputs.includes('BOM成本明细外发'));
  assert.equal(bound.source_label, 'MIXED');
});

test('buildEvidenceBoundSwarmRun merges provided intelligence pack with extra gaps', () => {
  const bound = buildEvidenceBoundSwarmRun({
    taskInput: 'PACK BMS 方案复核',
    entrySwarm: 'pack_rd',
    providedIntelligencePack: {
      packId: 'jinyiwei_existing_pack',
      sourceLabel: 'LIVE',
      facts: ['已有测试报告编号 R-001'],
      evidenceRefs: [
        {
          id: 'report_r001',
          label: '测试报告 R-001',
          claimType: 'FACT',
          sourceType: 'lab_report',
          sourceLabel: 'LIVE',
          summary: '低温放电测试报告',
        },
      ],
      missingEvidence: ['供应商准入未核'],
    },
    missingEvidence: ['客户验收边界未确认'],
  });

  assert.equal(bound.intelligence_pack_id, 'jinyiwei_existing_pack');
  assert.equal(bound.source_label, 'LIVE');
  assert.ok(bound.evidence_refs.includes('report_r001'));
  assert.ok(bound.missing_evidence.includes('供应商准入未核'));
  assert.ok(bound.missing_evidence.includes('客户验收边界未确认'));
});

test('buildEvidenceBoundSwarmRun downgrades source label when extra refs mix with LIVE pack', () => {
  const bound = buildEvidenceBoundSwarmRun({
    taskInput: 'PACK BMS 方案复核',
    entrySwarm: 'pack_rd',
    providedIntelligencePack: {
      packId: 'jinyiwei_live_pack',
      sourceLabel: 'LIVE',
      facts: ['已有测试报告编号 R-002'],
      evidenceRefs: [
        {
          id: 'report_r002',
          label: '测试报告 R-002',
          claimType: 'FACT',
          sourceType: 'lab_report',
          sourceLabel: 'LIVE',
          summary: '低温放电测试报告',
        },
      ],
    },
    evidenceRefs: ['用户新增口头需求'],
  });

  assert.equal(bound.source_label, 'MIXED');
  assert.equal(bound.intelligence_pack.sourceLabel, 'MIXED');
});

test('extractEvidenceBindingFromSession reads backend echoed evidence binding', () => {
  const bound = buildEvidenceBoundSwarmRun({
    taskInput: 'PACK 方案',
    entrySwarm: 'pack_rd',
  });

  const extracted = extractEvidenceBindingFromSession({
    status: 'completed',
    input_json: {
      evidence_bound_run: bound,
    },
    swarm_runs: [{ quality_score: 0.91 }],
  });

  assert.equal(extracted.status, 'bound');
  assert.equal(extracted.evidenceBoundRun?.intelligence_pack_id, bound.intelligence_pack_id);
  assert.equal(extracted.intelligencePack?.packId, bound.intelligence_pack.packId);
});

test('extractEvidenceBindingFromSession is explicit when backend did not return binding', () => {
  const extracted = extractEvidenceBindingFromSession({
    status: 'running',
    swarm_runs: [],
  });

  assert.equal(extracted.status, 'not_returned_by_backend');
  assert.equal(extracted.evidenceBoundRun, null);
  assert.equal(extracted.intelligencePack, null);
});

test('buildFeasibilityEnvelope preserves evidence binding on fail-closed response', () => {
  const evidenceBoundRun = buildEvidenceBoundSwarmRun({
    taskInput: 'PACK 报价可行性，但后端暂不可用',
    entrySwarm: 'pack_rd',
  });

  const envelope = buildFeasibilityEnvelope({
    jiqunOk: false,
    sessionId: null,
    reverify: null,
    evidenceBoundRun,
  });

  assert.equal(envelope.sourceLabel, 'FALLBACK');
  assert.equal(envelope.evidenceBoundRun?.intelligence_pack_id, evidenceBoundRun.intelligence_pack_id);
});
