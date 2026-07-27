import type {
  ContractTaskReadModelV1,
} from '@/lib/contracts/backend-openapi-2026-07-21';

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
  'STATE_INCONSISTENT',
] as const satisfies readonly ContractBlocker[];

const ACTION_SET = new Set<string>(CONTRACT_ACTIONS);
const BLOCKER_SET = new Set<string>(CONTRACT_BLOCKERS);
const SOURCE_CLASS_SET = new Set(['ADJUDICABLE', 'FALLBACK', 'UNKNOWN']);
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
    || !Array.isArray(delivery.artifacts)
    || !['READY', 'PARTIAL', 'UNDER_REVIEW'].includes(String(delivery.overall_status))
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
      && nonEmptyString(item.content_hash)
      && nonEmptyString(item.lineage_hash)
      && ['PENDING', 'STORED', 'UNAVAILABLE'].includes(String(item.status))
      && (item.download_url === undefined
        || item.download_url === null
        || nonEmptyString(item.download_url));
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
    && sha256(receipt.final_memorial_content_hash)
    && nonEmptyString(receipt.archived_at)
    && nonEmptyString(receipt.source_label);
}

function validFinalMemorial(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const final = record(value);
  return final !== null
    && nonEmptyString(final.final_memorial_id)
    && Number.isInteger(final.final_memorial_version)
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

export function parseContractTaskReadModel(value: unknown): ContractTaskReadModel {
  const model = record(value);
  if (
    !model
    || model.schema_version !== 'ContractTaskReadModelV1'
    || !nonEmptyString(model.read_revision)
    || !nonEmptyString(model.generated_at)
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
  if (!validFinalMemorial(model.final_memorial)) {
    throw new Error('invalid final memorial');
  }
  if (!validArchiveReceipt(model.archive_receipt)) {
    throw new Error('invalid archive receipt');
  }
  if (!hasExactLineage(model)) {
    throw new Error('invalid contract lineage');
  }
  return model as ContractTaskReadModel;
}
