import type {
  ContractTaskReadModelV1,
} from '@/lib/contracts/backend-openapi-2026-07-21';
import { z } from 'zod';

export type ContractTaskReadModel = ContractTaskReadModelV1;
export type ContractAction = ContractTaskReadModelV1['allowed_actions'][number];
export type ContractBlocker = ContractTaskReadModelV1['blockers'][number]['code'];

export const CONTRACT_ACTIONS = [
  'CONFIRM_MISSION',
  'SUBMIT_EVIDENCE',
  'REFRESH_REVIEW',
  'GENERATE_DELIVERY',
  'RESUME_DELIVERY',
  'DOWNLOAD_ARTIFACT',
  'DECIDE',
  'REOPEN_ARCHIVE',
] as const satisfies readonly ContractAction[];

export const CONTRACT_BLOCKERS = [
  'MISSION_MISSING',
  'MISSION_CONFLICT',
  'MISSION_NOT_CONFIRMED',
  'EVIDENCE_INCOMPLETE',
  'REVIEW_PACK_MISSING',
  'FINAL_MEMORIAL_MISSING',
  'DELIVERY_MISSING',
  'PARTIAL_RECOVERY_REQUIRES_HARDENING',
  'NON_ADJUDICABLE_SOURCE',
  'LINEAGE_CONFLICT',
  'DELIVERY_INTEGRITY_FAILED',
  'ARCHIVE_RECEIPT_MISSING',
  'ARCHIVE_LINEAGE_CONFLICT',
  'REVIEW_REVISION_REQUIRED',
  'REVIEW_BLOCKED',
  'LEGAL_REVIEW_REQUIRED',
  'STATE_INCONSISTENT',
] as const satisfies readonly ContractBlocker[];

const ACTION_SET = new Set<string>(CONTRACT_ACTIONS);
const BLOCKER_SET = new Set<string>(CONTRACT_BLOCKERS);
const SOURCE_CLASS_SET = new Set(['ADJUDICABLE', 'FALLBACK', 'UNKNOWN']);
const ADJUDICABLE_RECEIPT_SOURCES = new Set([
  'LIVE',
  'MIXED',
  'LIVE_ENGINE',
  'LIVE_SWARM',
]);
const NON_EMPTY_STRING = z.string().min(1);
const ISO_TIMESTAMP = z.string().datetime({ offset: true });
const CONTRACT_JURISDICTION = z.enum(['CN_MAINLAND', 'UNSUPPORTED_OR_UNKNOWN']);
const CONTRACT_LANGUAGE = z.enum(['zh-CN', 'UNSUPPORTED_OR_UNKNOWN']);
const CONTRACT_TYPE = z.enum([
  'procurement',
  'sales',
  'service',
  'UNSUPPORTED_OR_UNKNOWN',
]);
const CONTRACT_ROLE = z.enum([
  'buyer',
  'seller',
  'service_provider',
  'other_party',
  'UNSUPPORTED_OR_UNKNOWN',
]);
const CONTRACT_QUESTION = z.enum([
  'contract_risk_screening',
  'UNSUPPORTED_OR_UNKNOWN',
]);
const ENGINE_TIER = z.enum([
  'deterministic',
  'validated_model',
  'fallback',
]);
const MISSION_SCHEMA = z.object({
  schema_version: z.literal('MissionContractV1').optional(),
  mission_contract_id: NON_EMPTY_STRING,
  task_id: NON_EMPTY_STRING,
  revision: z.number().int().min(1),
  jurisdiction: CONTRACT_JURISDICTION,
  language: CONTRACT_LANGUAGE,
  contract_type: CONTRACT_TYPE,
  our_role: CONTRACT_ROLE,
  legal_question: CONTRACT_QUESTION,
  goal: z.object({
    user_intent: NON_EMPTY_STRING,
    biggest_concern: NON_EMPTY_STRING,
    risk_tolerance: z.string().optional(),
  }).strict(),
  constraints: z.array(z.string()),
  prohibited_actions: z.array(z.string()),
  desired_outcome: z.object({
    required_artifacts: z.array(z.enum(['PDF', 'DOCX', 'JSON'])).min(1),
  }).strict(),
  assumptions: z.array(z.string()),
  budget_limit_minor: z.number().int().min(0),
  deadline_at: ISO_TIMESTAMP,
  read_scope: z.array(z.string()).min(1),
  plan_digest: z.string().regex(/^[0-9a-f]{64}$/),
  content_digest: z.string().length(64),
  created_at: NON_EMPTY_STRING,
}).strict();
const MISSION_VIEW_SCHEMA = z.object({
  state: z.enum(['DRAFT', 'CONFIRMED']),
  mission: MISSION_SCHEMA,
}).strict();
const RISK_ITEM_SCHEMA = z.object({
  schema_version: z.literal('ContractRiskItemV1').optional(),
  risk_item_id: NON_EMPTY_STRING,
  evidence_packet_id: NON_EMPTY_STRING,
  file_version_id: NON_EMPTY_STRING.nullable().optional(),
  page_number: z.number().int().min(1).nullable().optional(),
  clause_ref: NON_EMPTY_STRING.nullable().optional(),
  raw_excerpt: z.string().min(1).max(2000).nullable().optional(),
  risk_level: z.enum(['critical', 'high', 'medium', 'low']),
  explanation: z.string().min(1).max(2000),
  missing_evidence: z.array(z.string()).optional(),
  recommended_revision: z.string().min(1).max(4000),
  source_label: NON_EMPTY_STRING,
  engine_tier: ENGINE_TIER,
}).strict().superRefine((item, context) => {
  const hasAnchor = Boolean(item.file_version_id)
    && (item.page_number !== null && item.page_number !== undefined
      || Boolean(item.clause_ref))
    && Boolean(item.raw_excerpt);
  if (item.risk_level === 'critical' || item.risk_level === 'high') {
    if (!hasAnchor) {
      context.addIssue({
        code: 'custom',
        message: 'critical/high risk requires an original anchor',
      });
    }
  } else if (!hasAnchor && !(item.missing_evidence?.length)) {
    context.addIssue({
      code: 'custom',
      message: 'missing original anchor requires missing_evidence',
    });
  }
});
const REVIEW_PACK_SCHEMA = z.object({
  schema_version: z.literal('ContractReviewPackV1').optional(),
  review_pack_id: NON_EMPTY_STRING,
  tenant_id: NON_EMPTY_STRING,
  task_id: NON_EMPTY_STRING,
  mission_contract_id: NON_EMPTY_STRING,
  court_review_id: NON_EMPTY_STRING,
  evidence_packet_ids: z.array(NON_EMPTY_STRING).min(1),
  jurisdiction: CONTRACT_JURISDICTION,
  language: CONTRACT_LANGUAGE,
  contract_type: CONTRACT_TYPE,
  our_role: CONTRACT_ROLE,
  legal_question: CONTRACT_QUESTION,
  risk_items: z.array(RISK_ITEM_SCHEMA),
  verdict: z.enum([
    'NEED_INFO',
    'REVISE_BEFORE_PROCEED',
    'PROCEED_TO_HUMAN_APPROVAL',
    'BLOCKED',
    'NEED_LEGAL_REVIEW',
  ]),
  decision_summary: NON_EMPTY_STRING,
  affected_sections: z.array(NON_EMPTY_STRING).min(1),
  source_labels: z.array(NON_EMPTY_STRING).min(1),
  engine_tiers: z.array(ENGINE_TIER).min(1),
  quality_gate_status: z.enum(['PENDING', 'PASSED', 'FAILED']),
  candidate_status: z.literal('CANDIDATE').optional(),
}).strict().superRefine((pack, context) => {
  if (
    pack.verdict === 'PROCEED_TO_HUMAN_APPROVAL'
    && pack.risk_items.some((item) => item.risk_level === 'critical')
  ) {
    context.addIssue({
      code: 'custom',
      message: 'critical risk cannot proceed to approval',
    });
  }
  if (
    [
      pack.jurisdiction,
      pack.language,
      pack.contract_type,
      pack.our_role,
      pack.legal_question,
    ].includes('UNSUPPORTED_OR_UNKNOWN')
    && pack.verdict !== 'NEED_LEGAL_REVIEW'
  ) {
    context.addIssue({
      code: 'custom',
      message: 'unsupported scope requires legal review',
    });
  }
  const evidencePacketIds = new Set(pack.evidence_packet_ids);
  if (pack.risk_items.some(
    (item) => !evidencePacketIds.has(item.evidence_packet_id),
  )) {
    context.addIssue({
      code: 'custom',
      message: 'risk item evidence is outside the review pack',
    });
  }
});
const PUBLIC_DELIVERY_KEYS = new Set([
  'manifest_id',
  'task_id',
  'final_memorial_id',
  'final_memorial_version',
  'delivery_formula_version',
  'delivery_revision',
  'payload_hash',
  'artifacts',
  'overall_status',
  'resume_token_expires_at',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function sha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isoTimestamp(value: unknown): value is string {
  return ISO_TIMESTAMP.safeParse(value).success;
}

export function isCanonicalArtifactDownloadUrl(
  value: unknown,
  artifactId: unknown,
): value is string {
  return nonEmptyString(value)
    && nonEmptyString(artifactId)
    && /^[A-Za-z0-9_-]+$/.test(artifactId)
    && value === `/api/artifacts/${artifactId}/download`;
}

function validMission(value: unknown): boolean {
  return value === null
    || value === undefined
    || MISSION_VIEW_SCHEMA.safeParse(value).success;
}

function validReviewPack(value: unknown): boolean {
  return value === null
    || value === undefined
    || REVIEW_PACK_SCHEMA.safeParse(value).success;
}

function validTask(value: unknown): boolean {
  const task = record(value);
  return task !== null
    && nonEmptyString(task.task_id)
    && Number.isInteger(task.tenant_id)
    && Number(task.tenant_id) > 0
    && nonEmptyString(task.status)
    && nonEmptyString(task.source_label)
    && nonEmptyString(task.raw_question);
}

function validDelivery(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const delivery = record(value);
  if (!delivery) return false;
  if (Object.keys(delivery).some((key) => !PUBLIC_DELIVERY_KEYS.has(key))) return false;
  if (
    !nonEmptyString(delivery.manifest_id)
    || !nonEmptyString(delivery.task_id)
    || !nonEmptyString(delivery.final_memorial_id)
    || !Number.isInteger(delivery.final_memorial_version)
    || !nonEmptyString(delivery.delivery_formula_version)
    || !Number.isInteger(delivery.delivery_revision)
    || !nonEmptyString(delivery.payload_hash)
    || !sha256(delivery.payload_hash)
    || !Array.isArray(delivery.artifacts)
    || delivery.artifacts.length === 0
    || !['READY', 'PARTIAL', 'UNDER_REVIEW'].includes(String(delivery.overall_status))
    || (
      delivery.resume_token_expires_at !== null
      && delivery.resume_token_expires_at !== undefined
      && !isoTimestamp(delivery.resume_token_expires_at)
    )
  ) {
    return false;
  }
  return delivery.artifacts.every((value) => {
    const item = record(value);
    return item !== null
      && nonEmptyString(item.artifact_id)
      && ['PDF', 'DOCX', 'JSON'].includes(String(item.kind))
      && nonEmptyString(item.mime_type)
      && Number.isInteger(item.byte_size)
      && Number(item.byte_size) >= 0
      && sha256(item.content_hash)
      && sha256(item.lineage_hash)
      && ['PENDING', 'STORED', 'UNAVAILABLE'].includes(String(item.status))
      && (
        item.expires_at === undefined
        || item.expires_at === null
        || isoTimestamp(item.expires_at)
      )
      && (item.download_url === undefined
        || item.download_url === null
        || (
          item.status === 'STORED'
          && isCanonicalArtifactDownloadUrl(
            item.download_url,
            item.artifact_id,
          )
        ))
      && (
        item.status !== 'UNAVAILABLE'
        || nonEmptyString(item.incomplete_reason)
      );
  });
}

function validArchiveReceipt(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const receipt = record(value);
  return receipt !== null
    && nonEmptyString(receipt.archive_id)
    && nonEmptyString(receipt.task_id)
    && nonEmptyString(receipt.final_memorial_id)
    && Number.isInteger(receipt.final_memorial_version)
    && Number(receipt.final_memorial_version) >= 1
    && sha256(receipt.final_memorial_content_hash)
    && isoTimestamp(receipt.archived_at)
    && nonEmptyString(receipt.source_label)
    && ADJUDICABLE_RECEIPT_SOURCES.has(receipt.source_label);
}

function validFinalMemorial(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const final = record(value);
    return final !== null
    && nonEmptyString(final.final_memorial_id)
    && Number.isInteger(final.final_memorial_version)
    && Number(final.final_memorial_version) >= 1
    && sha256(final.final_memorial_content_hash)
    && nonEmptyString(final.court_review_id)
    && nonEmptyString(final.status)
    && nonEmptyString(final.source_label);
}

function hasExactLineage(model: Record<string, unknown>): boolean {
  const task = record(model.task);
  const missionView = record(model.mission);
  const mission = record(missionView?.mission);
  const final = record(model.final_memorial);
  const delivery = record(model.delivery);
  const receipt = record(model.archive_receipt);
  const pack = record(model.review_pack);
  if (!task) return false;
  const taskId = task.task_id;

  if (
    missionView
    && (
      !mission
      || mission.task_id !== taskId
      || mission.mission_contract_id !== taskId
    )
  ) {
    return false;
  }
  if (
    pack
    && (
      pack.task_id !== taskId
      || pack.mission_contract_id !== taskId
      || String(pack.tenant_id) !== String(task.tenant_id)
      || (final && pack.court_review_id !== final.court_review_id)
      || (
        mission
        && (
          pack.jurisdiction !== mission.jurisdiction
          || pack.language !== mission.language
          || pack.contract_type !== mission.contract_type
          || pack.our_role !== mission.our_role
          || pack.legal_question !== mission.legal_question
        )
      )
    )
  ) {
    return false;
  }
  if (
    delivery
    && (
      !final
      || delivery.task_id !== taskId
      || delivery.final_memorial_id !== final.final_memorial_id
      || delivery.final_memorial_version !== final.final_memorial_version
    )
  ) {
    return false;
  }
  if (
    receipt
    && (
      !final
      || receipt.task_id !== taskId
      || receipt.final_memorial_id !== final.final_memorial_id
      || receipt.final_memorial_version !== final.final_memorial_version
      || receipt.final_memorial_content_hash
        !== final.final_memorial_content_hash
    )
  ) {
    return false;
  }
  return true;
}

function hasCompleteReadyArtifactPacket(
  delivery: Record<string, unknown> | null,
): boolean {
  if (delivery?.overall_status !== 'READY' || !Array.isArray(delivery.artifacts)) {
    return false;
  }
  const artifacts = delivery.artifacts.map(record);
  if (artifacts.some((artifact) => artifact === null)) return false;
  const kinds = new Set(artifacts.map((artifact) => artifact?.kind));
  return artifacts.length === 3
    && kinds.size === 3
    && ['PDF', 'DOCX', 'JSON'].every((kind) => kinds.has(kind))
    && artifacts.every((artifact) => (
      artifact?.status === 'STORED'
      && nonEmptyString(artifact.download_url)
    ));
}

function hasConsistentDecisionState(model: Record<string, unknown>): boolean {
  const actions = model.allowed_actions as unknown[];
  const canDecide = actions.includes('DECIDE');
  const canReopen = actions.includes('REOPEN_ARCHIVE');
  if (!canDecide && !canReopen) return true;

  const missionView = record(model.mission);
  const pack = record(model.review_pack);
  const final = record(model.final_memorial);
  const delivery = record(model.delivery);
  const packSourceLabels = Array.isArray(pack?.source_labels)
    ? pack.source_labels
    : [];
  const packEngineTiers = Array.isArray(pack?.engine_tiers)
    ? pack.engine_tiers
    : [];
  const riskItems = Array.isArray(pack?.risk_items)
    ? pack.risk_items.map(record)
    : [];
  const adjudicablePack = packSourceLabels.length > 0
    && packSourceLabels.every((label) => label === 'TASK_EVIDENCE')
    && packEngineTiers.length > 0
    && packEngineTiers.every((tier) => tier !== 'fallback')
    && riskItems.every((item) => (
      item !== null
      && item.source_label === 'TASK_EVIDENCE'
      && packSourceLabels.includes(item.source_label)
      && item.engine_tier !== 'fallback'
      && packEngineTiers.includes(item.engine_tier)
    ));
  const commonFactsValid = model.source_class === 'ADJUDICABLE'
    && missionView?.state === 'CONFIRMED'
    && pack?.verdict === 'PROCEED_TO_HUMAN_APPROVAL'
    && pack.quality_gate_status === 'PASSED'
    && adjudicablePack
    && hasCompleteReadyArtifactPacket(delivery)
    && (model.blockers as unknown[]).length === 0;
  if (!commonFactsValid || (canDecide && canReopen)) return false;
  if (canDecide) {
    return final?.status === 'ready_for_decision'
      && model.archive_receipt == null;
  }
  return final?.status === 'archived'
    && record(model.archive_receipt) !== null;
}

export function parseContractTaskReadModel(
  value: unknown,
  expectedTaskId: string,
): ContractTaskReadModel {
  const model = record(value);
  if (
    !model
    || model.schema_version !== 'ContractTaskReadModelV1'
    || !sha256(model.read_revision)
    || !isoTimestamp(model.generated_at)
    || typeof model.source_class !== 'string'
    || !SOURCE_CLASS_SET.has(model.source_class)
    || !validTask(model.task)
    || !Array.isArray(model.allowed_actions)
    || !Array.isArray(model.blockers)
  ) {
    throw new Error('invalid contract read model or source class');
  }
  for (const action of model.allowed_actions) {
    if (typeof action !== 'string' || !ACTION_SET.has(action)) {
      throw new Error(`unknown contract action: ${String(action)}`);
    }
  }
  for (const value of model.blockers) {
    const blocker = record(value);
    if (!blocker || typeof blocker.code !== 'string' || !BLOCKER_SET.has(blocker.code)) {
      throw new Error(`unknown contract blocker: ${String(blocker?.code)}`);
    }
  }
  if (!validDelivery(model.delivery)) {
    throw new Error('invalid contract delivery');
  }
  if (!validMission(model.mission)) {
    throw new Error('invalid contract mission');
  }
  if (!validReviewPack(model.review_pack)) {
    throw new Error('invalid contract review pack');
  }
  if (!validFinalMemorial(model.final_memorial)) {
    throw new Error('invalid final memorial');
  }
  if (!validArchiveReceipt(model.archive_receipt)) {
    throw new Error('invalid archive receipt');
  }
  if (!hasExactLineage(model)) {
    throw new Error('invalid contract lineage');
  }
  if (!hasConsistentDecisionState(model)) {
    throw new Error('contradictory contract decision state');
  }
  const task = record(model.task);
  if (task?.task_id !== expectedTaskId) {
    throw new Error('contract read model does not match requested task');
  }
  return model as ContractTaskReadModel;
}
