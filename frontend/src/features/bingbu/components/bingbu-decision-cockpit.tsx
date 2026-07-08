'use client';

/**
 * 兵部 · 销售决策卷轴（中栏 hero · 2026-06-27）
 *
 * 完全复刻户部 HubuDecisionCockpit 的排布与交互：「全部待决销售」队列，每张卡 = 30 秒拍板单元，
 * CRO 引擎真判断（兵部裁决灯 + 问题类型 + 缺证 + 跨部复核 + 唯一下一步）+ 随卡讲解 ❔ + 真 ask 追问(接地率)。
 * 复用冻结帝金系统；拍板写回属真实产线资产→后端 jiqun(铁律9)，本版只读+追问+意向。
 */
import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, FileWarning, HelpCircle, Loader2, ShieldAlert, Skull, Sparkles } from 'lucide-react';

import { useBingbuOverview } from '@/features/bingbu/hooks/use-bingbu-overview';
import { SALES_RISK_LABEL, type BingbuSalesItem } from '@/lib/contracts/bingbu-sales';
import { evaluateSalesItem, SALES_SIGNAL_LIGHT } from '@/features/bingbu/lib/bingbu-engines';
import { SUB_OFFICE_NAMES } from '@/core/courtos/bingbu/bingbu-cro-sales-office';
import {
  BINGBU_BACKEND_BUREAU_BY_ID,
  bureausForItem,
  leadOfficeForItem,
  officesForItem,
  type BingbuBackendBureauId,
} from '@/features/bingbu/lib/bingbu-roster';
import { withRealSalesItems } from '@/features/bingbu/lib/bingbu-real-decisions';
import { cleanSalesQuestion } from '@/features/bingbu/lib/sales-extract';
import { ruinForSalesItem, ruinBadge } from '@/features/qintian/lib/ruin-map';
import { AskAnswerPanel, type AskResult } from '@/features/shared/components/ask-answer-panel';

const ACCENT = '#6BA0FF';

const PRIORITY_RANK: Record<BingbuSalesItem['priority'], number> = { P0: 0, P1: 1, P2: 2 };
const RISK_RANK: Record<BingbuSalesItem['risk_level'], number> = { critical: 0, high: 1, medium: 2, low: 3 };

function byUrgency(a: BingbuSalesItem, b: BingbuSalesItem): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || RISK_RANK[a.risk_level] - RISK_RANK[b.risk_level];
}

const QUEUE_VISIBLE = 6;

/** 标题展示：复用 SSOT cleanSalesQuestion（不再并行实现），过长截断。 */
function cleanTitle(raw: string): string {
  const base = cleanSalesQuestion(raw) || raw;
  return base.length > 40 ? `${base.slice(0, 40)}…` : base;
}

function panelStyle(accent: string) {
  return {
    borderColor: `${accent}26`,
    background: `linear-gradient(180deg, ${accent}12 0%, rgba(6, 8, 14, 0.92) 100%)`,
  } as const;
}

export function BingbuDecisionCockpit() {
  const { overview, isLoading, error } = useBingbuOverview();
  const [asking, setAsking] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AskResult>>({});
  const [showAll, setShowAll] = useState(false);
  const [openExplain, setOpenExplain] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const siFilter = searchParams.get('si');
  const bureauFilter = searchParams.get('bureau');
  const selectedId = searchParams.get('item');
  const overviewItems = overview?.items;
  // ?bureau=<后端六司id> 是用户可见主口径；?si=<CRO内部席位> 仅保留兼容旧链接。
  const items = useMemo(() => {
    const all = withRealSalesItems(overviewItems ?? []).sort(byUrgency);
    if (bureauFilter && bureauFilter in BINGBU_BACKEND_BUREAU_BY_ID) {
      return all.filter((i) => bureausForItem(i).includes(bureauFilter as BingbuBackendBureauId));
    }
    return siFilter ? all.filter((i) => (officesForItem(i) as string[]).includes(siFilter)) : all;
  }, [overviewItems, bureauFilter, siFilter]);

  function selectItem(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get('item') === id) params.delete('item');
    else params.set('item', id);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const shown = showAll ? items : items.slice(0, QUEUE_VISIBLE);

  async function askItem(i: BingbuSalesItem) {
    setAsking(i.id);
    try {
      const command = i.command?.trim() || `「${i.title}」客户${i.counterparty}、金额${i.amount}——该推进还是该复核？给证据依据。`;
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/court/bingbu/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (res.status === 401) {
        // 体面降级:未登录不报红 401,提示"登录后可问"+ 安抚核心裁决无需登录。
        setAnswers((s) => ({ ...s, [i.id]: { needsAuth: true, deptName: '兵部' } }));
        return;
      }
      const json = (await res.json()) as AskResult & { ok?: boolean; error?: string };
      setAnswers((s) => ({
        ...s,
        [i.id]: !res.ok || json.ok === false ? { error: json.error ?? `兵部暂时无法应答（${res.status}）` } : json,
      }));
    } catch {
      setAnswers((s) => ({ ...s, [i.id]: { error: '网络异常，兵部未应答' } }));
    } finally {
      setAsking(null);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      <h2 className="display-serif text-[16px] text-[#F5E9C9]">
        今日待陛下拍板{items.length ? ` · ${items.length} 件` : ''}
      </h2>

      {isLoading && <SkeletonCard />}
      {error && <p className="body-copy text-[#E5604D]">兵部总览暂时拉取失败，请稍后重试。</p>}
      {!isLoading && !error && items.length === 0 && (
        <p className="body-copy text-[#b6ab8c]">当前没有待决的销售事项。兵部待命中。</p>
      )}

      {shown.map((i) => {
        const ev = evaluateSalesItem(i);
        const tl = SALES_SIGNAL_LIGHT[ev.signal];
        const ans = answers[i.id];
        const leadOffice = SUB_OFFICE_NAMES[leadOfficeForItem(i)];
        const ruin = ruinBadge(ruinForSalesItem(i));
        const isSelected = selectedId === i.id;
        return (
          <article
            key={i.id}
            onClick={() => selectItem(i.id)}
            className="hud-corner relative cursor-pointer rounded-[16px] border px-4 py-3.5 transition"
            style={{
              ...panelStyle(ACCENT),
              borderColor: isSelected ? `${ACCENT}66` : `${ACCENT}26`,
              boxShadow: isSelected ? `0 0 0 1px ${ACCENT}40` : undefined,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: i.priority === 'P0' ? '#E5604D22' : '#6BA0FF18', color: i.priority === 'P0' ? '#E5604D' : ACCENT }}
                  >
                    {i.priority}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${ACCENT}1c`, color: ACCENT }} title="CRO 内部主办席位">
                    {leadOffice}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: '#ffffff0a', color: '#9aa0ad' }}>
                    {ev.questionTypeCn}
                  </span>
                  <h3 className="truncate text-[15px] font-medium text-[#F5E9C9]" title={i.title}>
                    {cleanTitle(i.title)}
                  </h3>
                  {i.asked_count > 1 && (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px]" style={{ background: '#ffffff10', color: '#9aa0ad' }} title="同一问题被下达的次数">
                      已问 ×{i.asked_count}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[12px] text-[#b6ab8c]">
                  客户 <span className="text-[#E9DDBE]">{i.counterparty}</span> · 阶段{' '}
                  <span className="text-[#E9DDBE]">{i.stage}</span> · 金额{' '}
                  <span className="text-[#E9DDBE]">{i.amount}</span>
                  {i.industry !== '—' && <> · 行业 <span className="text-[#E9DDBE]">{i.industry}</span></>}
                  {i.delivery !== '—' && <> · 交期 <span className="text-[#E9DDBE]">{i.delivery}</span></>}
                  {i.prepayment !== '—' && <> · 预付 <span className="text-[#E9DDBE]">{i.prepayment}</span></>}
                </div>
                {i.terms.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {i.terms.map((term) => (
                      <span key={term} className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: '#E5604D14', color: '#E5847A' }}>
                        {term}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px]" style={{ color: tl.dot }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tl.dot }} />
                {tl.label}
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5 text-[12.5px] leading-relaxed">
              <p className="text-[#d8cba8]">
                <span className="text-[#8f835f]">兵部裁决：</span>
                <span className="font-medium" style={{ color: tl.dot }}>{ev.positionCn}</span>
                <span className="text-[#9aa0ad]"> — {ev.questionTypeCn} · 风险 {SALES_RISK_LABEL[i.risk_level]}</span>
              </p>
              {ev.missing.length > 0 && (
                <p className="flex items-start gap-1 text-[#9aa0ad]">
                  <FileWarning size={13} className="mt-0.5 shrink-0" />
                  <span><span className="text-[#8f835f]">缺证：</span>{ev.missing.slice(0, 5).join('、')}</span>
                </p>
              )}
              {ev.crossReviews.length > 0 && (
                <p className="flex items-start gap-1 text-[#c9a86a]">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span><span className="text-[#8f835f]">需跨审：</span>{ev.crossReviews.join('、')}</span>
                </p>
              )}
              {ev.humanConfirmationRequired && (
                <p className="flex items-start gap-1 text-[#E5604D]">
                  <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                  <span>高风险销售动作 · 须人工确认，不得自动外发</span>
                </p>
              )}
              {ruin.veto && (
                <div className="flex items-start gap-1.5 rounded-[8px] border px-2 py-1.5 text-[12px]" style={{ borderColor: '#E5604D44', background: '#E5604D12', color: '#E5847A' }}>
                  <Skull size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium text-[#E5604D]">钦天监 · 死法地图一票否决</span>
                    <span className="text-[#8f835f]"> — 触 ruin 红线 [{ruin.redlines.join(' · ')}]</span>
                    <span className="text-[#9aa0ad]">（后果不可逆，不看期望收益多漂亮）</span>
                  </span>
                </div>
              )}
              <p className="text-[#d8cba8]">
                <span className="text-[#8f835f]">唯一下一步：</span>{ev.nextAction}
              </p>

              <button
                onClick={(e) => { e.stopPropagation(); setOpenExplain((id) => (id === i.id ? null : i.id)); }}
                className="inline-flex items-center gap-1 text-[11.5px] text-[#b6ab8c] transition hover:text-[#F5E9C9]"
              >
                <HelpCircle size={13} />
                {openExplain === i.id ? '收起讲解' : '兵部讲解 · 每个判断怎么来的'}
              </button>
              {openExplain === i.id && (
                <div className="space-y-1 rounded-[10px] border px-2.5 py-2 text-[11.5px] text-[#bdb191]" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
                  <p>❔ 类型：{ev.explain.type}</p>
                  <p>❔ 裁决：{ev.explain.position}</p>
                  <p>❔ 跨审：{ev.explain.cross}</p>
                  <p>❔ 质门：{ev.explain.gate}</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <VerdictButton label="推进" tone="approve" />
              <VerdictButton label="补证" tone="neutral" />
              <VerdictButton label="升维复核" tone="reject" />
              <button
                onClick={(e) => { e.stopPropagation(); askItem(i); }}
                disabled={asking === i.id}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] text-[#E9DDBE] transition hover:text-[#fff] disabled:opacity-60"
                style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}12` }}
              >
                {asking === i.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                追问兵部
              </button>
            </div>

            {ans && <AskAnswerPanel result={ans} accent={ACCENT} />}
          </article>
        );
      })}

      {items.length > QUEUE_VISIBLE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 self-center rounded-full border px-4 py-1.5 text-[12px] text-[#d8cba8] transition hover:text-[#F5E9C9]"
          style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0c` }}
        >
          {showAll ? `收起 · 只看最急的 ${QUEUE_VISIBLE} 件` : `还有 ${items.length - QUEUE_VISIBLE} 件待决 · 展开全部`}
        </button>
      )}
    </section>
  );
}

function VerdictButton({ label, tone }: { label: string; tone: 'approve' | 'reject' | 'neutral' }) {
  const color = tone === 'approve' ? '#5FB97A' : tone === 'reject' ? '#E5604D' : '#b6ab8c';
  // 拍板「意向」按钮：本版只读+意向，真实执行（报价/合同/对外承诺）经后端 jiqun 确认（铁律9）。
  // 显式 title + cursor-default，避免用户误以为点击即已下达/触发跨部门复核（会审 HIGH）。
  return (
    <button
      onClick={(e) => e.stopPropagation()}
      title="拍板意向 · 真实执行经后端确认（铁律9）"
      className="cursor-default rounded-full border px-3 py-1 text-[12px] transition hover:brightness-125"
      style={{ borderColor: `${color}50`, color, background: `${color}10` }}
    >
      {label}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[16px] border px-4 py-4" style={panelStyle(ACCENT)}>
      <div className="h-4 w-1/3 rounded bg-white/10" />
      <div className="mt-3 h-3 w-2/3 rounded bg-white/5" />
      <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
    </div>
  );
}
