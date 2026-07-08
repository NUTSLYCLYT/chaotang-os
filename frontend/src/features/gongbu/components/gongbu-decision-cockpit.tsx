'use client';

/**
 * 工部 · 决策卷轴（中栏 hero · M1）
 * 建设任务卡：分类 + 定性裁决 + 🔒产线资产锁(铁律9) + 跨部会审 + 缺证 + 随卡讲解 + 真进度条。
 * 工部克制：真实成本/BOM/交期不渲染，整字段上锁转后端。
 */
import { useState } from 'react';
import { AlertTriangle, FileWarning, HelpCircle, Lock, Users } from 'lucide-react';

import { useGongbuTasks } from '@/features/gongbu/hooks/use-gongbu-tasks';
import { evaluateTask, dedupeTasksByTitle, type GongbuVerdict } from '@/features/gongbu/lib/gongbu-engines';

const ACCENT = '#7FC9A8';

const VERDICT_LIGHT: Record<GongbuVerdict, { dot: string; label: string }> = {
  approve: { dot: '#5FB97A', label: '准奏 · 已交付' },
  amend: { dot: '#E5B84D', label: '削 MVP · 补证' },
  review: { dot: '#4A82F0', label: '复核 / 转后端' },
  reject: { dot: '#E5604D', label: '驳回' },
};

const QUEUE_VISIBLE = 6;
const ACTIVE = new Set(['running', 'submitted', 'planning', 'queued', 'in_progress']);

function cleanTitle(raw: string): string {
  const quoted = raw.match(/[“"]([^”"]{4,})[”"]/);
  const base = (quoted ? quoted[1] : raw.replace(/^请[^，。：:、]{0,10}(围绕|就|对|审查|判断|建设|实现)\s*/, '')).trim();
  return base.length > 40 ? `${base.slice(0, 40)}…` : base;
}

function panelStyle(accent: string) {
  return { borderColor: `${accent}26`, background: `linear-gradient(180deg, ${accent}12 0%, rgba(6, 8, 14, 0.92) 100%)` } as const;
}

export function GongbuDecisionCockpit() {
  const { tasks, isLoading, error } = useGongbuTasks();
  const [showAll, setShowAll] = useState(false);
  const [openExplain, setOpenExplain] = useState<string | null>(null);

  // 去重(高效简洁:主库重复污染如「分析低温电池市场」×N)+ 待决优先(在办排前)
  const queue = dedupeTasksByTitle(tasks).sort((a, b) => Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status)));
  const shown = showAll ? queue : queue.slice(0, QUEUE_VISIBLE);

  return (
    <section id="gongbu-queue" className="flex min-h-0 flex-col gap-3 pr-1">
      <h2 className="display-serif text-[16px] text-[#EAF3EE]">
        待裁建设任务{queue.length ? ` · ${queue.length} 件` : ''}
      </h2>

      {isLoading && <SkeletonCard />}
      {error && <p className="body-copy text-[#E5604D]">工部任务暂时拉取失败（后端蜂群可能未启动），请稍后重试。</p>}
      {!isLoading && !error && queue.length === 0 && (
        <p className="body-copy text-[#a7b3ac]">当前没有待裁建设任务。工部待命中。（任务源：主库 / 后端 tasks）</p>
      )}

      {shown.map((t) => {
        const ev = evaluateTask(t);
        const tl = VERDICT_LIGHT[ev.verdict];
        return (
          <article key={t.id} className="hud-corner relative rounded-[16px] border px-4 py-3.5" style={panelStyle(ACCENT)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-medium text-[#EAF3EE]" title={t.title}>{cleanTitle(t.title)}</h3>
                <div className="mt-1 text-[12px] text-[#a7b3ac]">类型 {ev.explain.type.replace('分类为「', '').replace('」（按任务文本关键词）', '')} · 状态 {t.status}</div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px]" style={{ color: tl.dot }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tl.dot }} />
                {tl.label}
              </span>
            </div>

            {/* 真进度条 */}
            {ACTIVE.has(t.status) && t.progressPct > 0 && (
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#ffffff10' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, t.progressPct)}%`, background: ACCENT }} />
                </div>
                <span className="mt-0.5 inline-block text-[10.5px] text-[#7a8a82]">进度 {t.progressPct}%</span>
              </div>
            )}

            <div className="mt-2.5 space-y-1.5 text-[12.5px] leading-relaxed">
              <p className="text-[#cfe0d6]">
                <span className="text-[#7a8a82]">工部裁决：</span>
                <span className="font-medium" style={{ color: tl.dot }}>{ev.verdictCn}</span>
              </p>

              {ev.locks.length > 0 && (
                <p className="flex items-start gap-1 rounded-[8px] px-1.5 py-1 text-[#9ec5ff]" style={{ background: '#4A82F012' }}>
                  <Lock size={13} className="mt-0.5 shrink-0" />
                  <span><span className="font-medium">产线资产上锁：</span>{ev.locks.join('、')} · 不在前端渲染，转后端 jiqun 核算（铁律9）</span>
                </p>
              )}

              {ev.forbidden.length > 0 && (
                <p className="flex items-start gap-1 rounded-[8px] px-1.5 py-1 text-[#E5604D]" style={{ background: '#E5604D12' }}>
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span><span className="font-medium">对外承诺 · 需陛下亲裁：</span>{ev.forbidden.join('；')}</span>
                </p>
              )}

              {ev.cross.length > 0 && (
                <p className="flex items-start gap-1 text-[#bda7e0]">
                  <Users size={13} className="mt-0.5 shrink-0" />
                  <span><span className="text-[#7a8a82]">需跨部会审：</span>{ev.cross.map((c) => c.cn).join('、')}</span>
                </p>
              )}

              {ev.missing.length > 0 && (
                <p className="flex items-start gap-1 text-[#a7b3ac]">
                  <FileWarning size={13} className="mt-0.5 shrink-0" />
                  <span><span className="text-[#7a8a82]">缺证：</span>{ev.missing.join('、')}</span>
                </p>
              )}

              <button onClick={() => setOpenExplain((id) => (id === t.id ? null : t.id))} className="inline-flex items-center gap-1 text-[11.5px] text-[#8fa39a] transition hover:text-[#EAF3EE]">
                <HelpCircle size={13} /> {openExplain === t.id ? '收起讲解' : '工部讲解 · 这条怎么判的'}
              </button>
              {openExplain === t.id && (
                <div className="space-y-1 rounded-[10px] border px-2.5 py-2 text-[11.5px] text-[#aebeb5]" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
                  <p>❔ 分类：{ev.explain.type}</p>
                  <p>❔ 裁决：{ev.explain.verdict}</p>
                  <p>❔ 产线锁：{ev.explain.locks}</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <VerdictButton label="准奏" tone="approve" />
              <VerdictButton label="补证" tone="neutral" />
              <VerdictButton label="复核" tone="review" />
              <VerdictButton label="驳回" tone="reject" />
            </div>
          </article>
        );
      })}

      {queue.length > QUEUE_VISIBLE && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-1 self-center rounded-full border px-4 py-1.5 text-[12px] text-[#cfe0d6] transition hover:text-[#EAF3EE]" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0c` }}>
          {showAll ? `收起 · 只看前 ${QUEUE_VISIBLE} 件` : `还有 ${queue.length - QUEUE_VISIBLE} 件 · 展开全部`}
        </button>
      )}
    </section>
  );
}

function VerdictButton({ label, tone }: { label: string; tone: 'approve' | 'reject' | 'neutral' | 'review' }) {
  const color = tone === 'approve' ? '#5FB97A' : tone === 'reject' ? '#E5604D' : tone === 'review' ? '#4A82F0' : '#a7b3ac';
  return (
    <button className="rounded-full border px-3 py-1 text-[12px] transition hover:brightness-125" style={{ borderColor: `${color}50`, color, background: `${color}10` }}>
      {label}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[16px] border px-4 py-4" style={panelStyle(ACCENT)}>
      <div className="h-4 w-1/3 rounded bg-white/10" />
      <div className="mt-3 h-3 w-2/3 rounded bg-white/5" />
    </div>
  );
}
