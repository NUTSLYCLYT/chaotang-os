'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import ShiguanDrawer from './ShiguanDrawer';
import { ShiguanArchiveIndexPanel } from './ShiguanArchiveIndexPanel';
import GlassPanel from './GlassPanel';
import { ShiguanReviewRecallPanel } from './ShiguanReviewRecallPanel';
import { ShiguanScrollPanel } from './ShiguanScrollPanel';
import { ShiguanSourceBadge } from './ShiguanSourceBadge';
import { ShiguanThreeColumnLayout } from './ShiguanThreeColumnLayout';
import { chaotang } from '@/lib/api/chaotang';
import { withBasePath } from '@/lib/base-path';
import {
  useArchiveRecords,
  useArchiveStats,
} from '@/features/shiguan/lib/use-shiguan';
import {
  buildArchiveDetail,
  buildShiguanStatsView,
  knowledgeToArchiveItems,
  lessonsToView,
  promoToArchiveItems,
  recordsToArchiveItems,
  type ImaKnowledgeDocumentLike,
  type PromoArchiveLike,
  type ScribeLessonLike,
  type ShiguanArchiveListItem,
} from '@/features/shiguan-ui/lib/shiguan-view-model';
import {
  contractTaskReadModelPath,
  getContractTaskReadModel,
} from '@/features/contract-review/api';
import {
  buildContractArchiveDetail,
  buildContractArchiveEdictView,
  selectArchiveDetail,
} from '@/features/contract-review/archive-readback';
import { EdictStage } from '@/features/shangshufang/components/MemorialScroll';

export default function ShiguanPage() {
  const { data: archiveStats } = useArchiveStats();
  const { data: archivePayload, mutate: mutateArchiveRecords } = useArchiveRecords(80);
  const records = archivePayload?.data ?? [];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contractTaskId, setContractTaskId] = useState<string | null>(null);
  const [requestedArchiveId, setRequestedArchiveId] = useState<string | null>(null);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [imaKnowledgeDocs, setImaKnowledgeDocs] = useState<ImaKnowledgeDocumentLike[]>([]);
  const [promoArchive, setPromoArchive] = useState<PromoArchiveLike | null>(null);
  const [scribeLessons, setScribeLessons] = useState<ScribeLessonLike[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadKnowledgeCount() {
      const result = await chaotang.knowledgeCount().catch(() => ({ count: 0 }));
      if (!cancelled) setKnowledgeCount(result.count);
    }
    void loadKnowledgeCount();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSideSources() {
      const [knowledge, promo, lessons] = await Promise.all([
        fetch(withBasePath('/api/court/ima-knowledge?limit=20'), { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch(withBasePath('/api/court/shiguan/promo-archive'), { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch(withBasePath('/api/scribe/lessons'), { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      ]);
      if (cancelled) return;
      setImaKnowledgeDocs(Array.isArray(knowledge?.data?.documents) ? knowledge.data.documents : []);
      setPromoArchive(promo?.data && typeof promo.data === 'object' ? promo.data : null);
      setScribeLessons(Array.isArray(lessons?.data?.lessons) ? lessons.data.lessons : Array.isArray(lessons?.lessons) ? lessons.lessons : []);
    }
    void loadSideSources();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialId = params.get('archiveId') || params.get('taskId') || params.get('knowledgeId');
    setContractTaskId(params.get('taskId'));
    setRequestedArchiveId(params.get('archiveId'));
    if (initialId) setSelectedId(initialId);
  }, []);

  const {
    data: contractReadModel,
    error: contractReadModelError,
  } = useSWR(
    contractTaskId ? contractTaskReadModelPath(contractTaskId) : null,
    () => getContractTaskReadModel(contractTaskId!),
  );

  const archiveItems = useMemo<ShiguanArchiveListItem[]>(() => {
    return [
      ...recordsToArchiveItems(records),
      ...knowledgeToArchiveItems(imaKnowledgeDocs),
      ...promoToArchiveItems(promoArchive),
    ];
  }, [imaKnowledgeDocs, promoArchive, records]);

  useEffect(() => {
    if (!selectedId && archiveItems.length > 0) setSelectedId(archiveItems[0].id);
  }, [archiveItems, selectedId]);

  const stats = useMemo(
    () => buildShiguanStatsView({
      stats: archiveStats,
      records,
      knowledgeCount: Math.max(knowledgeCount, imaKnowledgeDocs.length),
    }),
    [archiveStats, imaKnowledgeDocs.length, knowledgeCount, records],
  );

  const lessons = useMemo(() => lessonsToView(scribeLessons), [scribeLessons]);
  const selectedItem = archiveItems.find((item) => item.id === selectedId) ?? null;
  const indexedDetail = useMemo(() => buildArchiveDetail(selectedItem, lessons), [lessons, selectedItem]);
  const exactContractDetail = useMemo(
    () => contractReadModel && !contractReadModelError
      ? buildContractArchiveDetail(contractReadModel, requestedArchiveId)
      : null,
    [contractReadModel, contractReadModelError, requestedArchiveId],
  );
  const exactContractIdentityFailed = Boolean(
    contractReadModel
    && !contractReadModelError
    && (requestedArchiveId || contractReadModel.archive_receipt)
    && !exactContractDetail,
  );
  const exactContractReadFailed = Boolean(contractReadModelError)
    || exactContractIdentityFailed;
  const selectedDetail = selectArchiveDetail(
    contractTaskId,
    exactContractDetail,
    indexedDetail,
    exactContractReadFailed,
  );
  const similarCases = useMemo(() => {
    if (!selectedItem) return [];
    return archiveItems
      .filter((item) => item.id !== selectedItem.id && (item.type === selectedItem.type || item.department === selectedItem.department))
      .slice(0, 6);
  }, [archiveItems, selectedItem]);

  const handleRetroUpdate = useCallback(
    async (archiveId: string, status: string) => {
      const response = await fetch(withBasePath(`/api/shiguan/archives/${encodeURIComponent(archiveId)}/retrospective`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retrospective_status: status }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await mutateArchiveRecords();
    },
    [mutateArchiveRecords],
  );

  return (
    <div
      className="relative h-full min-h-0"
      data-contract-read-model-status={
        exactContractReadFailed
            ? 'error'
            : contractReadModel
              ? 'ready'
            : contractTaskId
              ? 'loading'
              : 'inactive'
      }
    >
      <main className="relative h-full min-h-0 overflow-hidden text-[#EAEEFB]">
        <div className="relative z-10 mx-auto flex h-full max-w-[1680px] flex-col px-4 pb-3 pt-3">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-gold-200/70">Shiguan Memory Router</div>
              <h1 className="mt-1 font-serif text-[24px] font-semibold text-gold-gradient">太史馆</h1>
              <p className="mt-0.5 max-w-[760px] text-[11px] leading-4 text-slatey-300">
                归档、复盘、旧案召回与可信留痕。中间卷轴展示当前案卷，左右面板负责索引和反哺。
              </p>
              {contractTaskId && exactContractReadFailed ? (
                <div
                  className="mt-1.5 text-[10px] text-red-300"
                  data-testid="contract-archive-readback-error"
                >
                  精确归档回读失败；当前普通索引不代表该合同案卷已验证。
                </div>
              ) : exactContractDetail ? (
                <div
                  className="mt-1.5 flex max-w-[900px] flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-emerald-200"
                  data-testid="contract-archive-identity"
                >
                  <span className="font-semibold">精确归档</span>
                  <span>{contractReadModel?.archive_receipt?.final_memorial_id}</span>
                  <span className="font-mono text-emerald-100/75">
                    {contractReadModel?.archive_receipt?.final_memorial_content_hash.slice(0, 12)}
                  </span>
                </div>
              ) : contractTaskId && contractReadModel ? (
                <div
                  className="mt-1.5 text-[10px] text-amber-200"
                  data-testid="contract-archive-receipt-missing"
                >
                  当前合同任务没有可验证的精确归档回执。
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="shrink-0 rounded border border-gold-300/24 bg-gold-300/[0.06] px-2.5 py-1.5 text-[10.5px] text-gold-100 hover:bg-gold-300/[0.12]"
            >
              打开史馆说明
            </button>
          </div>

          <ShiguanThreeColumnLayout
            left={
              <ShiguanArchiveIndexPanel
                stats={stats}
                items={archiveItems}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            }
            center={
              exactContractDetail ? (
                <div
                  className="h-full min-h-0"
                  data-testid="contract-archive-scroll"
                >
                  <EdictStage
                    view={buildContractArchiveEdictView(exactContractDetail)}
                    hideFooter
                  />
                </div>
              ) : (
                <ShiguanScrollPanel detail={selectedDetail} stats={stats} />
              )
            }
            right={
              exactContractDetail ? (
                <ExactContractArchiveAuditPanel
                  detail={exactContractDetail}
                />
              ) : (
                <ShiguanReviewRecallPanel
                  detail={selectedDetail}
                  lessons={lessons}
                  similarCases={similarCases}
                  onRetroUpdate={handleRetroUpdate}
                />
              )
            }
          />
        </div>
      </main>

      <ShiguanDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

function ExactContractArchiveAuditPanel({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof buildContractArchiveDetail>>;
}) {
  return (
    <GlassPanel
      title="归档审计"
      eyebrow="Read-only Audit"
      className="flex h-full min-h-0 flex-col"
      bodyClassName="min-h-0 flex-1 overflow-y-auto"
    >
      <div
        className="space-y-3 text-[11px] leading-5 text-slatey-300"
        data-testid="contract-archive-audit-panel"
      >
        <section className="rounded border border-emerald-400/16 bg-emerald-400/[0.045] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] text-emerald-200/75">
                只读审计
              </div>
              <div className="mt-1 text-[13px] font-semibold text-jade-100">
                精确 ArchiveReceipt 回放
              </div>
            </div>
            <ShiguanSourceBadge sourceLabel={detail.sourceLabel} />
          </div>
          <p className="mt-2">
            此视图只展示已验证归档事实，不提供复盘写入或后续裁决动作。
          </p>
        </section>

        <dl className="space-y-2 rounded border border-gold-300/12 bg-white/[0.03] p-3">
          <div>
            <dt className="text-[10px] text-gold-200/70">Archive ID</dt>
            <dd className="mt-0.5 break-all font-mono text-jade-100">
              {detail.id}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-gold-200/70">结论</dt>
            <dd className="mt-0.5 text-jade-100">{detail.conclusion}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-gold-200/70">审计链节点</dt>
            <dd className="mt-0.5 text-jade-100">
              {detail.decisionChain.length}
            </dd>
          </div>
        </dl>
      </div>
    </GlassPanel>
  );
}
