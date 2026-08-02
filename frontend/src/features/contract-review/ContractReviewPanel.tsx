'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  ArchiveRestore,
  Download,
  FileCheck2,
  Gavel,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { withBasePath } from '@/lib/base-path';
import {
  approveContractTask,
  confirmContractMission,
  contractTaskReadModelPath,
  createContractDelivery,
  downloadContractArtifact,
  getContractTaskReadModel,
} from './api';
import {
  contractReviewUiPolicy,
  isContractTaskReadModel,
} from './action-policy';
import {
  DeliveryAttemptRegistry,
  type DeliveryAttemptIdentity,
} from './delivery-attempt';
import type { ContractAction } from './read-model';

const ACTION_LABELS: Partial<Record<ContractAction, string>> = {
  CONFIRM_MISSION: '确认审查任务',
  SUBMIT_EVIDENCE: '补充合同证据',
  REFRESH_REVIEW: '重新会审',
  GENERATE_DELIVERY: '生成审查包',
  DECIDE: '批准并归档',
  REOPEN_ARCHIVE: '重新打开案卷',
};

const BLOCKER_LABELS: Record<string, string> = {
  MISSION_MISSING: '尚未建立审查任务',
  MISSION_CONFLICT: '审查任务版本冲突',
  MISSION_NOT_CONFIRMED: '审查任务尚未确认',
  EVIDENCE_INCOMPLETE: '合同证据尚未补齐',
  REVIEW_PACK_MISSING: '尚未形成审查结论包',
  FINAL_MEMORIAL_MISSING: '尚未形成正式奏折',
  DELIVERY_MISSING: '审查包尚未生成',
  PARTIAL_RECOVERY_REQUIRES_HARDENING: '部分交付可下载；刷新后暂不支持恢复',
  NON_ADJUDICABLE_SOURCE: '当前来源不可进入正式裁决',
  LINEAGE_CONFLICT: '合同事实链不一致',
  DELIVERY_INTEGRITY_FAILED: '交付物已过期或完整性校验失败',
  ARCHIVE_RECEIPT_MISSING: '归档回执缺失',
  ARCHIVE_LINEAGE_CONFLICT: '归档事实链不一致',
  REVIEW_REVISION_REQUIRED: '审查结论要求修订合同后重新会审',
  REVIEW_BLOCKED: '审查结论已阻止继续推进',
  LEGAL_REVIEW_REQUIRED: '当前合同必须转人工法务复核',
  STATE_INCONSISTENT: '当前事实状态不一致',
};

const PRIMARY_ACTION_ORDER: ContractAction[] = [
  'CONFIRM_MISSION',
  'SUBMIT_EVIDENCE',
  'REFRESH_REVIEW',
  'GENERATE_DELIVERY',
  'DECIDE',
  'REOPEN_ARCHIVE',
];

export function ContractReviewPanel({
  taskId,
  onWorkflowAction,
  onContractIdentityChange,
}: {
  taskId: string;
  onWorkflowAction?: (action: 'SUBMIT_EVIDENCE' | 'REFRESH_REVIEW') => void;
  onContractIdentityChange?: (isContractTask: boolean) => void;
}) {
  const {
    data: model,
    error,
    isLoading,
    mutate,
  } = useSWR(
    contractTaskReadModelPath(taskId),
    () => getContractTaskReadModel(taskId),
    { refreshInterval: 10_000 },
  );
  const [commandError, setCommandError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<ContractAction | null>(null);
  const deliveryAttempts = useRef<DeliveryAttemptRegistry | null>(null);
  if (deliveryAttempts.current === null) {
    deliveryAttempts.current = new DeliveryAttemptRegistry(
      () => crypto.randomUUID(),
    );
  }
  const policy = model ? contractReviewUiPolicy(model) : null;
  const isContractTask = model ? isContractTaskReadModel(model) : false;
  useEffect(() => {
    onContractIdentityChange?.(isContractTask);
  }, [isContractTask, onContractIdentityChange]);
  const primaryAction = useMemo(
    () => PRIMARY_ACTION_ORDER.find((action) => model?.allowed_actions.includes(action)) ?? null,
    [model],
  );

  if (isLoading) {
    return (
      <div className="mb-2 flex min-h-10 items-center gap-2 border border-[#F0C66A33] bg-[#0E1724] px-3 py-2 text-[11px] text-[#C9B77F]">
        <Loader2 size={14} className="animate-spin" />
        正在核验合同事实链
      </div>
    );
  }
  if (error) {
    if (String(error).includes('404')) return null;
    return (
      <div className="mb-2 flex items-center gap-2 border border-[#D66B6B55] bg-[#2A1518] px-3 py-2 text-[11px] text-[#F0A4A4]">
        <AlertTriangle size={14} />
        合同事实链读取失败
      </div>
    );
  }
  if (!model || !policy || !isContractTask) return null;

  async function execute(action: ContractAction) {
    setCommandError(null);
    setBusyAction(action);
    try {
      if (action === 'CONFIRM_MISSION' && model?.mission) {
        await confirmContractMission(taskId, {
          revision: model.mission.mission.revision,
          content_digest: model.mission.mission.content_digest,
        });
      } else if (
        action === 'GENERATE_DELIVERY'
        && model?.review_pack
        && model.final_memorial
      ) {
        const attemptIdentity: DeliveryAttemptIdentity = {
          taskId,
          finalMemorialId: model.final_memorial.final_memorial_id,
          finalMemorialVersion: model.final_memorial.final_memorial_version,
          deliveryFormulaVersion: 'w06-v1',
        };
        await createContractDelivery({
          task_id: taskId,
          final_memorial_id: model.final_memorial.final_memorial_id,
          final_memorial_version: model.final_memorial.final_memorial_version,
          contract_review_pack: model.review_pack,
          delivery_formula_version: 'w06-v1',
          idempotency_key: deliveryAttempts.current!.keyFor(attemptIdentity),
          expiry_seconds: 86400,
        });
        deliveryAttempts.current!.confirm(attemptIdentity);
      } else if (action === 'DECIDE' && model?.final_memorial) {
        const response = await approveContractTask(taskId, {
          action: 'approve',
          reason: '人工确认合同审查包与风险裁决',
          human_confirmed: true,
          expected_final_memorial_content_hash:
            model.final_memorial.final_memorial_content_hash,
        });
        if (!response.success) throw new Error(response.error || '裁决未被接受');
      } else if (action === 'REOPEN_ARCHIVE' && model?.archive_receipt) {
        window.location.assign(withBasePath(
          `/shiguan?taskId=${encodeURIComponent(taskId)}&archiveId=${encodeURIComponent(model.archive_receipt.archive_id)}`,
        ));
        return;
      } else if (action === 'SUBMIT_EVIDENCE' || action === 'REFRESH_REVIEW') {
        onWorkflowAction?.(action);
      }
      await mutate();
    } catch (caught) {
      setCommandError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section
      className="mb-2 border border-[#F0C66A3D] bg-[#0E1724] px-3 py-2.5"
      data-testid="contract-review-panel"
      data-task-id={taskId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase text-[#A99768]">
            <FileCheck2 size={13} />
            ContractReviewPack
            <span className={policy.isLive ? 'text-[#73D6A0]' : 'text-[#E1A76C]'}>
              {policy.sourceState}
            </span>
          </div>
          <div className="mt-1 truncate text-[13px] font-semibold text-[#F5E9C9]">
            {model.task.raw_question}
          </div>
          {model.review_pack ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#B9AE90]">
              {model.review_pack.decision_summary}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#A99768]">
          <span>{model.delivery?.overall_status ?? 'NOT_DELIVERED'}</span>
          {policy.isArchived ? <span className="text-[#73D6A0]">ARCHIVED</span> : null}
        </div>
      </div>

      {model.blockers.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {model.blockers.map((blocker) => (
            <span
              key={blocker.code}
              className="border border-[#D9A65A44] bg-[#2A2114] px-2 py-1 text-[10px] text-[#DDBB78]"
            >
              {BLOCKER_LABELS[blocker.code] ?? blocker.code}
            </span>
          ))}
        </div>
      ) : null}

      {model.delivery?.artifacts.length && policy.canDownload ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {model.delivery.artifacts.map((artifact) => (
            <button
              key={artifact.artifact_id}
              type="button"
              disabled={!artifact.download_url || busyAction !== null}
              onClick={() => artifact.download_url
                && downloadContractArtifact(
                  artifact.download_url,
                  `${taskId}-${artifact.kind.toLowerCase()}`,
                ).catch((caught) => setCommandError(
                  caught instanceof Error ? caught.message : String(caught),
                ))}
              className="inline-flex h-7 items-center gap-1.5 border border-[#5B719055] bg-[#142033] px-2 text-[10px] text-[#C7D8ED] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={12} />
              {artifact.kind}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 text-[10px] text-[#C97A7A]">
          {commandError ? `操作失败：${commandError}` : null}
        </div>
        {primaryAction && ACTION_LABELS[primaryAction] ? (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void execute(primaryAction)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-[#F0C66A66] bg-[#33260D] px-3 text-[11px] font-semibold text-[#F4D98C] disabled:opacity-50"
            data-testid={`contract-action-${primaryAction.toLowerCase()}`}
          >
            {busyAction === primaryAction ? (
              <Loader2 size={13} className="animate-spin" />
            ) : primaryAction === 'DECIDE' ? (
              <Gavel size={13} />
            ) : primaryAction === 'REOPEN_ARCHIVE' ? (
              <ArchiveRestore size={13} />
            ) : (
              <RefreshCw size={13} />
            )}
            {ACTION_LABELS[primaryAction]}
          </button>
        ) : null}
      </div>
    </section>
  );
}
