import type { SourceLabel } from '../types';

export type EvidenceClaimType = 'FACT' | 'CLAIM' | 'MODEL_INFERENCE' | 'RUMOR';

export interface EvidenceRef {
  id: string;
  label: string;
  claimType: EvidenceClaimType;
  sourceType: string;
  sourceLabel: SourceLabel;
  summary: string;
}

export interface JinyiweiEvidencePackForSwarm {
  schema_version: 'JinyiweiEvidencePackForSwarmV1';
  packId: string;
  departmentId: 'jinyiwei';
  sourceLabel: SourceLabel;
  sourceUrls?: string[];
  financialSources?: Record<string, unknown>[];
  facts: string[];
  evidenceRefs: EvidenceRef[];
  missingEvidence: string[];
  unsupportedClaims: string[];
  forbiddenOutputs: string[];
  qualityGates: string[];
}

export interface EvidenceBoundSwarmRun {
  schema_version: 'EvidenceBoundSwarmRunV1';
  entry_swarm: string;
  task_input: string;
  intelligence_pack_id: string;
  intelligence_pack: JinyiweiEvidencePackForSwarm;
  evidence_refs: string[];
  missing_evidence: string[];
  forbidden_outputs: string[];
  source_label: SourceLabel;
}

export interface EvidenceBoundSwarmRunInput {
  taskInput: string;
  entrySwarm: string;
  providedIntelligencePack?: unknown;
  evidenceRefs?: unknown;
  missingEvidence?: unknown;
}

export interface ExtractedEvidenceBinding {
  evidenceBoundRun: EvidenceBoundSwarmRun | null;
  intelligencePack: JinyiweiEvidencePackForSwarm | null;
  status: 'bound' | 'not_returned_by_backend';
}

const DEFAULT_FORBIDDEN_OUTPUTS = [
  '正式报价',
  '供应商锁定',
  '确定交期承诺',
  'BOM成本明细外发',
];

const DEFAULT_QUALITY_GATES = [
  'source_label_required',
  'evidence_or_gap_required',
  'production_assets_must_be_locked',
  'human_confirmation_required_for_external_commitment',
];

const SOURCE_LABELS: SourceLabel[] = ['LIVE', 'LIVE_SWARM', 'MIXED', 'FALLBACK', 'DEMO'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function clip(value: string, max = 360): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function normalizeSourceLabel(value: unknown, fallback: SourceLabel = 'MIXED'): SourceLabel {
  return SOURCE_LABELS.includes(value as SourceLabel) ? (value as SourceLabel) : fallback;
}

function mergeSourceLabels(labels: SourceLabel[]): SourceLabel {
  const cleaned = labels.filter(Boolean);
  if (cleaned.length === 0) {
    return 'MIXED';
  }
  if (cleaned.every((label) => label === cleaned[0])) {
    return cleaned[0];
  }
  return 'MIXED';
}

function normalizeClaimType(value: unknown): EvidenceClaimType {
  return ['FACT', 'CLAIM', 'MODEL_INFERENCE', 'RUMOR'].includes(value as EvidenceClaimType)
    ? (value as EvidenceClaimType)
    : 'CLAIM';
}

function makeUserInputRef(taskInput: string): EvidenceRef {
  const hash = stableHash(taskInput);
  return {
    id: `user_claim_${hash}`,
    label: '用户原始PACK需求',
    claimType: 'CLAIM',
    sourceType: 'user_input',
    sourceLabel: 'MIXED',
    summary: clip(taskInput),
  };
}

function normalizeEvidenceRefs(value: unknown, taskInput: string): EvidenceRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const refs: EvidenceRef[] = [];
  value.forEach((item, index) => {
    if (typeof item === 'string') {
      const text = item.trim();
      if (!text) {
        return;
      }
      refs.push({
        id: `evidence_ref_${stableHash(`${text}:${index}`)}`,
        label: text,
        claimType: 'CLAIM',
        sourceType: 'provided_ref',
        sourceLabel: 'MIXED',
        summary: text,
      });
      return;
    }

    if (!isRecord(item)) {
      return;
    }

    const summary = String(item.summary ?? item.label ?? item.id ?? '').trim();
    if (!summary) {
      return;
    }
    refs.push({
      id: String(item.id ?? `evidence_ref_${stableHash(`${summary}:${index}`)}`).trim(),
      label: String(item.label ?? summary).trim(),
      claimType: normalizeClaimType(item.claimType ?? item.claim_type),
      sourceType: String(item.sourceType ?? item.source_type ?? 'provided_ref').trim(),
      sourceLabel: normalizeSourceLabel(item.sourceLabel ?? item.source_label, 'MIXED'),
      summary: clip(summary),
    });
  });

  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.id)) {
      return false;
    }
    seen.add(ref.id);
    return true;
  });
}

function inferMissingEvidence(taskInput: string): string[] {
  const text = taskInput.toLowerCase();
  const missing: string[] = [];

  if (!/\bBOM\b|物料清单|电芯型号|BMS/i.test(taskInput)) {
    missing.push('BOM/物料清单与关键器件型号未核验');
  }

  if (/报价|成本|预算|价格|毛利/.test(taskInput) && !/报价单|成本表|发票|合同|财务/.test(taskInput)) {
    missing.push('报价/成本/预算缺少供应商或财务证据');
  }

  if (/交期|交付|排产|量产/.test(taskInput) && !/排产|订单|合同|产能/.test(taskInput)) {
    missing.push('交期/交付承诺缺少排产与合同依据');
  }

  if (/供应商|供应链|采购|锁定/.test(taskInput) && !/准入|资质|合同|报价单|履约/.test(taskInput)) {
    missing.push('供应商锁定缺少准入资质与履约记录');
  }

  if (/冷库|低温|冷链|高温|温升|工况|-40|-30|-20/.test(taskInput) && !/曲线|测试|实验|报告|验证/.test(taskInput)) {
    missing.push('工况曲线/测试报告未提供');
  }

  if (text.includes('pack') && !/验收|测试|认证|标准/.test(taskInput)) {
    missing.push('PACK验收标准/测试标准未提供');
  }

  return uniq(missing);
}

function normalizeIntelligencePack(
  value: unknown,
  taskInput: string,
  entrySwarm: string,
): JinyiweiEvidencePackForSwarm | null {
  if (!isRecord(value)) {
    return null;
  }

  const facts = asStringArray(value.facts);
  const evidenceRefs = normalizeEvidenceRefs(value.evidenceRefs ?? value.evidence_refs, taskInput);
  if (facts.length === 0 && evidenceRefs.length === 0) {
    return null;
  }

  const packId = String(
    value.packId ?? value.pack_id ?? value.id ?? `jinyiwei_${entrySwarm}_${stableHash(taskInput)}`,
  ).trim();

  return {
    schema_version: 'JinyiweiEvidencePackForSwarmV1',
    packId,
    departmentId: 'jinyiwei',
    sourceLabel: normalizeSourceLabel(value.sourceLabel ?? value.source_label, 'MIXED'),
    sourceUrls: uniq(asStringArray(value.sourceUrls ?? value.source_urls)),
    financialSources: asRecordArray(value.financialSources ?? value.financial_sources ?? value.sources),
    facts: uniq(facts),
    evidenceRefs: evidenceRefs.length > 0 ? evidenceRefs : [makeUserInputRef(taskInput)],
    missingEvidence: uniq(asStringArray(value.missingEvidence ?? value.missing_evidence)),
    unsupportedClaims: uniq(asStringArray(value.unsupportedClaims ?? value.unsupported_claims)),
    forbiddenOutputs: uniq([
      ...DEFAULT_FORBIDDEN_OUTPUTS,
      ...asStringArray(value.forbiddenOutputs ?? value.forbidden_outputs),
    ]),
    qualityGates: uniq([
      ...DEFAULT_QUALITY_GATES,
      ...asStringArray(value.qualityGates ?? value.quality_gates),
    ]),
  };
}

export function buildPackIntelligencePack(
  taskInput: string,
  options: {
    entrySwarm?: string;
    evidenceRefs?: unknown;
    missingEvidence?: unknown;
    unsupportedClaims?: unknown;
    forbiddenOutputs?: unknown;
    qualityGates?: unknown;
  } = {},
): JinyiweiEvidencePackForSwarm {
  const entrySwarm = options.entrySwarm ?? 'pack_rd';
  const inferredMissing = inferMissingEvidence(taskInput);
  const missingEvidence = uniq([
    ...inferredMissing,
    ...asStringArray(options.missingEvidence),
  ]);
  const evidenceRefs = normalizeEvidenceRefs(options.evidenceRefs, taskInput);

  return {
    schema_version: 'JinyiweiEvidencePackForSwarmV1',
    packId: `jinyiwei_${entrySwarm}_${stableHash(taskInput)}`,
    departmentId: 'jinyiwei',
    sourceLabel: 'MIXED',
    facts: [
      `entry_swarm=${entrySwarm}`,
      '用户输入已登记为 CLAIM，未被锦衣卫升级为已核验 FACT',
      '触碰报价/BOM/供应商/交期时必须进入人工确认门',
    ],
    evidenceRefs: evidenceRefs.length > 0 ? evidenceRefs : [makeUserInputRef(taskInput)],
    missingEvidence,
    unsupportedClaims: uniq([
      ...(missingEvidence.length > 0
        ? ['当前PACK输入含未经锦衣卫核验的产线假设，不得升级为对外承诺']
        : []),
      ...asStringArray(options.unsupportedClaims),
    ]),
    forbiddenOutputs: uniq([
      ...DEFAULT_FORBIDDEN_OUTPUTS,
      ...asStringArray(options.forbiddenOutputs),
    ]),
    qualityGates: uniq([
      ...DEFAULT_QUALITY_GATES,
      ...asStringArray(options.qualityGates),
    ]),
  };
}

export function buildEvidenceBoundSwarmRun(
  input: EvidenceBoundSwarmRunInput,
): EvidenceBoundSwarmRun {
  const taskInput = input.taskInput.trim();
  const providedPack = normalizeIntelligencePack(
    input.providedIntelligencePack,
    taskInput,
    input.entrySwarm,
  );

  const basePack =
    providedPack ??
    buildPackIntelligencePack(taskInput, {
      entrySwarm: input.entrySwarm,
      evidenceRefs: input.evidenceRefs,
      missingEvidence: input.missingEvidence,
    });

  const extraRefs = normalizeEvidenceRefs(input.evidenceRefs, taskInput);
  const refsById = new Map<string, EvidenceRef>();
  [...basePack.evidenceRefs, ...extraRefs].forEach((ref) => refsById.set(ref.id, ref));

  const intelligencePack: JinyiweiEvidencePackForSwarm = {
    ...basePack,
    evidenceRefs: Array.from(refsById.values()),
    sourceLabel: mergeSourceLabels([
      basePack.sourceLabel,
      ...Array.from(refsById.values()).map((ref) => ref.sourceLabel),
    ]),
    missingEvidence: uniq([
      ...basePack.missingEvidence,
      ...asStringArray(input.missingEvidence),
    ]),
  };

  return {
    schema_version: 'EvidenceBoundSwarmRunV1',
    entry_swarm: input.entrySwarm,
    task_input: taskInput,
    intelligence_pack_id: intelligencePack.packId,
    intelligence_pack: intelligencePack,
    evidence_refs: intelligencePack.evidenceRefs.map((ref) => ref.id),
    missing_evidence: intelligencePack.missingEvidence,
    forbidden_outputs: intelligencePack.forbiddenOutputs,
    source_label: intelligencePack.sourceLabel,
  };
}

function normalizeEvidenceBoundRun(value: unknown): EvidenceBoundSwarmRun | null {
  if (!isRecord(value)) {
    return null;
  }

  const taskInput = String(value.task_input ?? value.taskInput ?? '').trim();
  const entrySwarm = String(value.entry_swarm ?? value.entrySwarm ?? 'pack_rd').trim() || 'pack_rd';
  const pack = normalizeIntelligencePack(
    value.intelligence_pack ?? value.intelligencePack,
    taskInput,
    entrySwarm,
  );
  if (!pack) {
    return null;
  }

  return {
    schema_version: 'EvidenceBoundSwarmRunV1',
    entry_swarm: entrySwarm,
    task_input: taskInput,
    intelligence_pack_id: String(value.intelligence_pack_id ?? value.intelligencePackId ?? pack.packId),
    intelligence_pack: pack,
    evidence_refs: uniq([
      ...asStringArray(value.evidence_refs ?? value.evidenceRefs),
      ...pack.evidenceRefs.map((ref) => ref.id),
    ]),
    missing_evidence: uniq([
      ...asStringArray(value.missing_evidence ?? value.missingEvidence),
      ...pack.missingEvidence,
    ]),
    forbidden_outputs: uniq([
      ...asStringArray(value.forbidden_outputs ?? value.forbiddenOutputs),
      ...pack.forbiddenOutputs,
    ]),
    source_label: normalizeSourceLabel(value.source_label ?? value.sourceLabel, pack.sourceLabel),
  };
}

function findFirstByKeys(value: unknown, keys: string[], depth = 0): unknown {
  if (depth > 5) {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstByKeys(item, keys, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const key of keys) {
    if (value[key]) {
      return value[key];
    }
  }
  for (const item of Object.values(value)) {
    const found = findFirstByKeys(item, keys, depth + 1);
    if (found) {
      return found;
    }
  }
  return null;
}

export function extractEvidenceBindingFromSession(session: unknown): ExtractedEvidenceBinding {
  const run = normalizeEvidenceBoundRun(
    findFirstByKeys(session, ['evidence_bound_run', 'evidenceBoundRun']),
  );
  if (run) {
    return {
      evidenceBoundRun: run,
      intelligencePack: run.intelligence_pack,
      status: 'bound',
    };
  }

  const pack = normalizeIntelligencePack(
    findFirstByKeys(session, ['intelligence_pack', 'intelligencePack']),
    '',
    'pack_rd',
  );
  if (pack) {
    return {
      evidenceBoundRun: null,
      intelligencePack: pack,
      status: 'bound',
    };
  }

  return {
    evidenceBoundRun: null,
    intelligencePack: null,
    status: 'not_returned_by_backend',
  };
}
