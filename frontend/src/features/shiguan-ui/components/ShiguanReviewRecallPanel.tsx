'use client';

import type { ReactNode } from 'react';
import GlassPanel from './GlassPanel';
import { ShiguanEmptyState } from './ShiguanEmptyState';
import { ShiguanSourceBadge } from './ShiguanSourceBadge';
import type { ShiguanArchiveDetail, ShiguanArchiveListItem, ShiguanLesson, ShiguanRetrospectiveStatus } from '../lib/shiguan-view-model';
import { isTruthySource } from '../lib/shiguan-source';

const STATUS_OPTIONS: Array<{ value: ShiguanRetrospectiveStatus; label: string }> = [
  { value: 'achieved', label: '达成' },
  { value: 'failed', label: '未达成' },
  { value: 'partial', label: '部分达成' },
  { value: 'watching', label: '观察中' },
];

const STATUS_TO_BACKEND: Record<ShiguanRetrospectiveStatus, string> = {
  pending: 'not_started',
  achieved: '达成',
  failed: '未达成',
  partial: '部分',
  watching: '观察中',
};

export function ShiguanReviewRecallPanel({
  detail,
  lessons,
  similarCases,
  onRetroUpdate,
}: {
  detail: ShiguanArchiveDetail | null;
  lessons: ShiguanLesson[];
  similarCases: ShiguanArchiveListItem[];
  onRetroUpdate: (archiveId: string, status: string) => Promise<void>;
}) {
  return (
    <GlassPanel
      title="复盘与召回"
      eyebrow="Review & Recall"
      className="flex h-full min-h-0 flex-col"
      bodyClassName="min-h-0 flex-1 overflow-y-auto"
    >
      {!detail ? (
        <ShiguanEmptyState
          title="选择案卷后查看复盘"
          body="右侧面板负责展示复盘状态、可复用教训、相似旧案和下一步动作。"
        />
      ) : (
        <div className="space-y-3">
          <section className="rounded-xl border border-gold-300/12 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-gold-200/70">Retrospective</div>
                <div className="mt-1 text-[13px] font-semibold text-jade-100">复盘状态：{statusText(detail.retrospectiveStatus)}</div>
              </div>
              <ShiguanSourceBadge sourceLabel={detail.sourceLabel} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!isTruthySource(detail.sourceLabel)}
                  onClick={() => void onRetroUpdate(detail.id, STATUS_TO_BACKEND[option.value])}
                  className={
                    detail.retrospectiveStatus === option.value
                      ? 'rounded border border-gold-300/45 bg-gold-300/12 px-2 py-1 text-[10px] text-gold-100 disabled:opacity-50'
                      : 'rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slatey-300 hover:text-gold-100 disabled:cursor-not-allowed disabled:opacity-40'
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            {!isTruthySource(detail.sourceLabel) && (
              <p className="mt-2 text-[10.5px] leading-4 text-slatey-400">
                当前案卷不是可信归档，复盘动作暂不可执行。
              </p>
            )}
          </section>

          <PanelBlock title="可复用教训" empty="暂无绑定 lessons。后端需要把复盘教训与案卷 ID 绑定后才能在此沉淀。">
            {(detail.lessons.length ? detail.lessons : lessons.slice(0, 4)).map((lesson) => (
              <div key={lesson.id} className="rounded-lg border border-gold-300/12 bg-black/18 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11.5px] font-semibold text-jade-100">{lesson.title}</div>
                    <div className="mt-1 text-[10.5px] leading-4 text-slatey-300">{lesson.detail}</div>
                  </div>
                  <ShiguanSourceBadge sourceLabel={lesson.sourceLabel} />
                </div>
              </div>
            ))}
          </PanelBlock>

          <PanelBlock title="相似旧案召回" empty="暂无相似旧案。后续接 /similar 接口后，这里展示可借鉴与不可照搬的旧案。">
            {similarCases.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-lg border border-gold-300/12 bg-black/18 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11.5px] font-semibold text-jade-100">{item.title}</div>
                    <div className="mt-1 text-[10px] text-slatey-400">{item.status}{item.department ? ` / ${item.department}` : ''}</div>
                  </div>
                  <ShiguanSourceBadge sourceLabel={item.sourceLabel} />
                </div>
              </div>
            ))}
          </PanelBlock>

          <section className="rounded-xl border border-emerald-400/16 bg-emerald-400/[0.045] p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/75">Next Action</div>
            <div className="mt-2 space-y-1.5 text-[11px] leading-5 text-jade-100/82">
              <div>1. 召回旧案给上书房作为判断上下文。</div>
              <div>2. 补齐证据链后生成史馆判词。</div>
              <div>3. 已复盘案卷可转为可复用模板。</div>
            </div>
          </section>
        </div>
      )}
    </GlassPanel>
  );
}

function PanelBlock({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className="rounded-xl border border-gold-300/12 bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-gold-200/70">{title}</div>
      <div className="mt-2 space-y-2">
        {items.length > 0 ? items : <p className="text-[10.5px] leading-5 text-slatey-400">{empty}</p>}
      </div>
    </section>
  );
}

function statusText(status: ShiguanRetrospectiveStatus): string {
  if (status === 'achieved') return '达成';
  if (status === 'failed') return '未达成';
  if (status === 'partial') return '部分达成';
  if (status === 'watching') return '观察中';
  return '待复盘';
}
