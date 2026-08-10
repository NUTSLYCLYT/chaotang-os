import type { ContractTaskReadModelV1 } from '@/lib/contracts/backend-openapi-2026-07-21';
import type { ShiguanArchiveDetail } from '@/features/shiguan-ui/lib/shiguan-view-model';
import { normalizeSourceLabel } from '@/features/shiguan-ui/lib/shiguan-source';
import type { EdictView } from '@/features/shangshufang/edict-content';
import { withBasePath } from '@/lib/base-path';

const ADJUDICABLE_RECEIPT_SOURCES = new Set([
  'LIVE',
  'MIXED',
  'LIVE_ENGINE',
  'LIVE_SWARM',
]);

export function buildDownloadHref(downloadUrl: string, basePath?: string): string {
  if (basePath) {
    const normalizedBase = basePath === '/' ? '' : basePath.replace(/\/$/, '');
    const normalizedPath = downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`;
    if (!normalizedBase || normalizedPath === normalizedBase || normalizedPath.startsWith(`${normalizedBase}/`)) {
      return normalizedPath;
    }
    return `${normalizedBase}${normalizedPath}`;
  }
  return withBasePath(downloadUrl);
}

export function buildContractArchiveDetail(
  model: ContractTaskReadModelV1,
  requestedArchiveId?: string | null,
): ShiguanArchiveDetail | null {
  const receipt = model.archive_receipt;
  const final = model.final_memorial;
  if (!receipt || !final) return null;
  if (
    model.source_class !== 'ADJUDICABLE'
    || model.delivery?.overall_status !== 'READY'
    || !model.allowed_actions.includes('REOPEN_ARCHIVE')
    || model.blockers.length > 0
    || !ADJUDICABLE_RECEIPT_SOURCES.has(receipt.source_label)
    || (requestedArchiveId != null && receipt.archive_id !== requestedArchiveId)
    || receipt.task_id !== model.task.task_id
    || receipt.final_memorial_id !== final.final_memorial_id
    || receipt.final_memorial_version !== final.final_memorial_version
    || receipt.final_memorial_content_hash
      !== final.final_memorial_content_hash
  ) {
    return null;
  }

  const sourceLabel = receipt.source_label === 'LIVE_ENGINE'
    ? 'LIVE'
    : normalizeSourceLabel(receipt.source_label);
  const pack = model.review_pack;
  const delivery = model.delivery;
  return {
    id: receipt.archive_id,
    title: model.task.raw_question,
    type: 'task',
    sourceLabel,
    summary: `任务 ${model.task.task_id} 的正式奏折 ${receipt.final_memorial_id} v${receipt.final_memorial_version} 已形成精确归档回执。`,
    conclusion: `史馆已按 exact lineage 回读 final hash ${receipt.final_memorial_content_hash.slice(0, 12)}…；该案卷不是客户端索引推断。`,
    retrospectiveStatus: 'pending',
    updatedAt: receipt.archived_at,
    decisionChain: [
      {
        id: final.court_review_id,
        title: '军机处会审',
        actor: '军机处',
        status: pack?.verdict ?? '已形成正式奏折',
        sourceLabel,
      },
      {
        id: final.final_memorial_id,
        title: `正式奏折 v${final.final_memorial_version}`,
        actor: '上书房',
        status: final.status,
        sourceLabel,
      },
      {
        id: receipt.archive_id,
        title: '史馆精确归档',
        actor: '太史令',
        status: '已归档',
        at: receipt.archived_at,
        sourceLabel,
      },
    ],
    evidence: [
      ...(pack?.evidence_packet_ids ?? []).map((id) => ({
        id,
        title: 'EvidencePacket',
        detail: `由 ContractReviewPack ${pack?.review_pack_id ?? ''} 引用`,
        sourceLabel,
      })),
      ...(delivery?.artifacts ?? []).map((artifact) => ({
        id: artifact.artifact_id,
        title: `${artifact.kind} 交付物`,
        detail: `${artifact.status} · ${artifact.content_hash.slice(0, 12)}…`,
        sourceLabel,
      })),
    ],
    lessons: [],
    downloads: (delivery?.artifacts ?? [])
      .filter((artifact) => artifact.download_url)
      .map((artifact) => ({
        label: artifact.kind,
        href: buildDownloadHref(artifact.download_url!),
      })),
  };
}

export function selectArchiveDetail(
  contractTaskId: string | null,
  exactDetail: ShiguanArchiveDetail | null,
  indexedDetail: ShiguanArchiveDetail | null,
  exactReadFailed = false,
): ShiguanArchiveDetail | null {
  if (!contractTaskId) return indexedDetail;
  return exactReadFailed ? null : exactDetail;
}

export function buildContractArchiveEdictView(
  detail: ShiguanArchiveDetail,
): EdictView {
  return {
    id: `contract-archive:${detail.id}:${detail.retrospectiveStatus}`,
    title: detail.title,
    subtitle: '史馆精确案卷',
    headerKicker: 'EXACT ARCHIVE',
    issuerLine: '太史令精确回读',
    question: detail.summary,
    meta: {
      reporter: '太史令',
      priority: 'medium',
      accent: '#3D8F78',
      accentSoft: '#F0C66A',
      badges: [
        { label: '精确归档', tone: 'green' },
        {
          label: detail.sourceLabel,
          tone: detail.sourceLabel === 'FALLBACK' ? 'amber' : 'green',
        },
      ],
      downloads: detail.downloads?.map((item) => ({
        label: item.label,
        href: item.href,
        kind: 'attachment',
      })),
    },
    rows: [
      {
        label: '来源',
        body: `${detail.sourceLabel} · exact ArchiveReceipt ${detail.id}`,
      },
      {
        label: '建议',
        body: '该案卷已完成精确归档，仅供审计回放；不提供新的裁决动作。',
      },
      {
        label: '事实摘要',
        body: detail.summary,
      },
      {
        label: '决策链',
        body: detail.decisionChain
          .map((item) => `${item.actor}：${item.title}（${item.status}）`)
          .join('\n'),
      },
      {
        label: '证据链',
        body: detail.evidence.length > 0
          ? detail.evidence
            .map((item) => `${item.title}：${item.detail}`)
            .join('\n')
          : '该精确回执未声明附加证据条目。',
      },
      {
        label: '史馆判词',
        body: detail.conclusion,
      },
    ],
    sealDate: detail.updatedAt,
    seal: 'imperial',
  };
}
