'use client';

/**
 * 吏部 HR 工作台共享组件（2026-06-29）
 *
 * 导出：INPUT_BASE / bdr / 三组 verdict config /
 *       BoolChip / HiringResult / TerminationResult /
 *       CompResult / CompResultPanel / PromotionResult
 */
import { useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from 'lucide-react';

import {
  HIRING_VERDICT_CN,
  type HiringReview,
} from '@/features/libu/lib/hiring-review';
import {
  TERMINATION_VERDICT_CN,
  type TerminationReview,
} from '@/features/libu/lib/termination-review';
import {
  suggestOffer,
  type CompBand,
} from '@/features/libu/lib/compensation-band';
import {
  PROMOTION_VERDICT_CN,
  type PromotionReview,
} from '@/features/libu/lib/promotion-review';
import {
  TRAINING_VERDICT_CN,
  type TrainingReview,
} from '@/features/libu/lib/training-review';
import {
  ORG_HEADCOUNT_VERDICT_CN,
  type OrgHeadcountReview,
} from '@/features/libu/lib/org-headcount-review';
import { ACCENT } from '@/features/libu/lib/libu-roster';
import { VerdictCard } from '@/features/shared/office-kit/verdict-card';
import { HUBU_FINANCE_CAPABILITY } from '@/features/shared/office-kit/finance-capability';

// ── 共用样式 ──────────────────────────────────────────────────────────────────

export const INPUT_BASE =
  'w-full rounded-[8px] border bg-transparent px-2.5 py-1.5 text-[11.5px] text-[#E9DDBE] placeholder:text-[#3a3e4c] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#A99CF0]';

export function bdr() {
  return { borderColor: `${ACCENT}28` };
}

// ── VERDICT CONFIG ────────────────────────────────────────────────────────────

export const HIRING_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  hire:         { color: '#3DD68C', bg: '#3DD68C0d', border: '#3DD68C30' },
  define_first: { color: '#E5B84D', bg: '#E5B84D0e', border: '#E5B84D34' },
  too_expensive:{ color: '#E5604D', bg: '#E5604D12', border: '#E5604D3a' },
  insufficient: { color: '#6a7080', bg: '#6a70800d', border: '#6a708030' },
};

export const TERM_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  safe:         { color: '#3DD68C', bg: '#3DD68C0d', border: '#3DD68C30' },
  risky:        { color: '#E5B84D', bg: '#E5B84D0e', border: '#E5B84D34' },
  illegal_risk: { color: '#E5604D', bg: '#E5604D12', border: '#E5604D3a' },
  insufficient: { color: '#6a7080', bg: '#6a70800d', border: '#6a708030' },
};

export const PROMO_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  promote:      { color: '#3DD68C', bg: '#3DD68C0d', border: '#3DD68C30' },
  extend:       { color: '#E5B84D', bg: '#E5B84D0e', border: '#E5B84D34' },
  reject:       { color: '#E5604D', bg: '#E5604D12', border: '#E5604D3a' },
  insufficient: { color: '#6a7080', bg: '#6a70800d', border: '#6a708030' },
};

export const TRAIN_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  train:        { color: '#3DD68C', bg: '#3DD68C0d', border: '#3DD68C30' },
  define_first: { color: '#E5B84D', bg: '#E5B84D0e', border: '#E5B84D34' },
  not_worth:    { color: '#E5604D', bg: '#E5604D12', border: '#E5604D3a' },
  insufficient: { color: '#6a7080', bg: '#6a70800d', border: '#6a708030' },
};

export const ORG_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  add:            { color: '#3DD68C', bg: '#3DD68C0d', border: '#3DD68C30' },
  reorg_first:    { color: '#E5B84D', bg: '#E5B84D0e', border: '#E5B84D34' },
  over_headcount: { color: '#E5604D', bg: '#E5604D12', border: '#E5604D3a' },
  insufficient:   { color: '#6a7080', bg: '#6a70800d', border: '#6a708030' },
};

// ── BoolChip ──────────────────────────────────────────────────────────────────

export function BoolChip({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="rounded-[6px] border px-2 py-0.5 text-[10px] transition focus:outline-none focus-visible:ring-1 focus-visible:ring-[#A99CF0]"
      aria-pressed={value}
      style={{
        borderColor: value ? `${ACCENT}60` : '#ffffff14',
        background: value ? `${ACCENT}18` : 'transparent',
        color: value ? ACCENT : '#5a6070',
      }}
      title={`${label}：人工判断`}
    >
      {label}
    </button>
  );
}

// ── HiringResult ──────────────────────────────────────────────────────────────

export function HiringResult({ result }: { result: HiringReview }) {
  return (
    <VerdictCard
      verdictCn={HIRING_VERDICT_CN[result.verdict]}
      cfg={HIRING_CONFIG[result.verdict] ?? HIRING_CONFIG.insufficient}
      title={result.role}
      metrics={[
        ...(result.annualCost != null ? [`年成本 ¥${result.annualCost.toLocaleString()}`] : []),
        ...(result.roi != null ? [`ROI ${result.roi}`] : []),
      ]}
      nextStep={result.nextStep}
      opinions={[result.selectionOpinion, result.financeOpinion]}
      blockers={result.blockers}
      collaborators={[{ name: HUBU_FINANCE_CAPABILITY.owner, accent: HUBU_FINANCE_CAPABILITY.accent, note: '帮算年成本/ROI' }]}
      sourceNote="LOCAL · 招人三件套本地验证（铁律9）"
    />
  );
}

// ── TerminationResult ─────────────────────────────────────────────────────────

export function TerminationResult({ result }: { result: TerminationReview }) {
  const [open, setOpen] = useState(false);
  const cfg = TERM_CONFIG[result.verdict] ?? TERM_CONFIG.insufficient;
  const needsSignoff = result.verdict === 'illegal_risk' || result.verdict === 'risky';

  return (
    <div
      className="rounded-[16px] border p-4"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      {needsSignoff && (
        <div
          className="mb-3 flex items-center gap-2 rounded-[10px] border px-3 py-2"
          style={{ borderColor: '#E5604D44', background: '#E5604D14' }}
        >
          <AlertTriangle size={13} style={{ color: '#E5604D' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#E5604D' }}>
            needsSignoff · 高风险人事决策，须人工确认再执行（铁律13.2.5）
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{ background: `${cfg.color}22`, color: cfg.color }}
        >
          {TERMINATION_VERDICT_CN[result.verdict]}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-[#F5E9C9]">{result.employeeName}</span>
        {result.severanceN != null && (
          <span className="font-mono text-[11.5px] text-[#b6ab8c]">N = {result.severanceN} 月</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[#5a6070] transition hover:text-[#b6ab8c]"
          aria-label={open ? '收起' : '展开'}
        >
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      <p className="mt-1.5 text-[11.5px]" style={{ color: `${cfg.color}cc` }}>
        {result.legalRisk}
      </p>
      <p className="mt-1 text-[11px] text-[#8a9aaa]">{result.legalPath}</p>

      {open && (
        <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: `${cfg.color}18` }}>
          <div className="text-[11px] text-[#8a9aaa]">{result.laborOpinion}</div>
          <div className="text-[11px] text-[#8a9aaa]">{result.costOpinion}</div>
          {result.payout.note && (
            <div
              className="rounded-[6px] border border-dashed px-2 py-1 font-mono text-[10px]"
              style={{ borderColor: `${cfg.color}20`, color: `${cfg.color}99` }}
            >
              {result.payout.note}
            </div>
          )}
          {result.blockers.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {result.blockers.map((b) => (
                <span
                  key={b}
                  className="rounded-[6px] border border-dashed px-1.5 py-0.5 text-[10px]"
                  style={{ borderColor: '#E5604D28', color: '#E5604D99' }}
                >
                  ⚠ {b}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-[10px] text-[#4a5060]">
        LOCAL · 劳动法合规分析（铁律9）
      </p>
    </div>
  );
}

// ── CompResultPanel ───────────────────────────────────────────────────────────

export interface CompResult {
  band: CompBand;
  offer: ReturnType<typeof suggestOffer>;
}

export function CompResultPanel({ result }: { result: CompResult }) {
  const { band, offer } = result;
  const hasData = band.min != null;

  return (
    <div
      className="rounded-[16px] border p-4"
      style={{
        borderColor: hasData ? `${ACCENT}28` : '#ffffff10',
        background: hasData ? `${ACCENT}06` : 'rgba(6,8,14,0.4)',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp size={14} style={{ color: ACCENT }} />
        <span className="text-[13px] font-semibold text-[#F5E9C9]">薪酬带宽 · {band.level}</span>
        <span
          className="ml-auto rounded-full border px-2 py-0.5 text-[10px]"
          style={{ borderColor: `${ACCENT}30`, color: `${ACCENT}cc` }}
        >
          LOCAL · 市场中位±20%
        </span>
      </div>

      {hasData ? (
        <>
          <div className="flex items-end gap-2 text-center text-[11px]">
            <div className="flex-1 rounded-[6px] py-1" style={{ background: '#ffffff08' }}>
              <div className="text-[#6a7080]">Min</div>
              <div className="mt-0.5 font-mono font-semibold text-[#E9DDBE]">
                ¥{band.min?.toLocaleString()}
              </div>
            </div>
            <div
              className="flex-1 rounded-[6px] py-2"
              style={{ background: `${ACCENT}18`, borderWidth: 1, borderColor: `${ACCENT}44` }}
            >
              <div style={{ color: ACCENT }}>中位</div>
              <div className="mt-0.5 font-mono text-[14px] font-bold text-[#F5E9C9]">
                ¥{band.mid?.toLocaleString()}
              </div>
            </div>
            <div className="flex-1 rounded-[6px] py-1" style={{ background: '#ffffff08' }}>
              <div className="text-[#6a7080]">Max</div>
              <div className="mt-0.5 font-mono font-semibold text-[#E9DDBE]">
                ¥{band.max?.toLocaleString()}
              </div>
            </div>
          </div>

          {offer.salary != null && (
            <div
              className="mt-3 rounded-[10px] border px-3 py-2"
              style={{ borderColor: `${ACCENT}2a`, background: `${ACCENT}0c` }}
            >
              <div className="flex items-center gap-2">
                <BadgeCheck size={13} style={{ color: ACCENT }} />
                <span
                  className="text-[11px] uppercase tracking-[0.12em]"
                  style={{ color: `${ACCENT}88` }}
                >
                  定薪建议
                </span>
                <span className="ml-auto font-mono text-[13px] font-bold text-[#F5E9C9]">
                  ¥{offer.salary.toLocaleString()}
                </span>
                <span className="text-[10px]" style={{ color: `${ACCENT}aa` }}>
                  {offer.percentile}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#8a9aaa]">{offer.note}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-[11.5px] text-[#E5B84D88]">{band.note}</p>
      )}

      <p className="mt-2 text-[10px] text-[#4a5060]">
        LOCAL · 宽带薪酬本地计算（铁律9）；市场中位可由锦衣卫填行业基准
      </p>
    </div>
  );
}

// ── PromotionResult ───────────────────────────────────────────────────────────

export function PromotionResult({ result }: { result: PromotionReview }) {
  const cfg = PROMO_CONFIG[result.verdict] ?? PROMO_CONFIG.insufficient;

  return (
    <div
      className="rounded-[16px] border p-4"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{ background: `${cfg.color}22`, color: cfg.color }}
        >
          {PROMOTION_VERDICT_CN[result.verdict]}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-[#F5E9C9]">{result.candidate}</span>
        {result.scorePct != null && (
          <span className="font-mono text-[11.5px] text-[#b6ab8c]">
            {result.totalScore}/{result.maxTotal}（{result.scorePct}%）
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11.5px]" style={{ color: `${cfg.color}cc` }}>
        {result.note}
      </p>

      {result.missing.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {result.missing.map((m) => (
            <span
              key={m}
              className="rounded-[6px] border border-dashed px-1.5 py-0.5 text-[10px]"
              style={{ borderColor: '#E5B84D28', color: '#E5B84D99' }}
            >
              缺评分：{m}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-[10px] text-[#4a5060]">
        LOCAL · 评分表本地解析（铁律9）；吏部不替老板打分
      </p>
    </div>
  );
}

// ── TrainingResult ────────────────────────────────────────────────────────────

export function TrainingResult({ result }: { result: TrainingReview }) {
  return (
    <VerdictCard
      verdictCn={TRAINING_VERDICT_CN[result.verdict]}
      cfg={TRAIN_CONFIG[result.verdict] ?? TRAIN_CONFIG.insufficient}
      title={result.role}
      metrics={result.roi != null ? [`ROI ${result.roi}`] : []}
      nextStep={result.nextStep}
      opinions={[result.ldOpinion, result.financeOpinion]}
      blockers={result.blockers}
      collaborators={[{ name: HUBU_FINANCE_CAPABILITY.owner, accent: HUBU_FINANCE_CAPABILITY.accent, note: '帮算培训ROI' }]}
      sourceNote="LOCAL · 培训三件套本地验证（铁律9）"
    />
  );
}

// ── OrgHeadcountResult ────────────────────────────────────────────────────────

export function OrgHeadcountResult({ result }: { result: OrgHeadcountReview }) {
  return (
    <VerdictCard
      verdictCn={ORG_HEADCOUNT_VERDICT_CN[result.verdict]}
      cfg={ORG_CONFIG[result.verdict] ?? ORG_CONFIG.insufficient}
      title={result.role}
      metrics={[
        ...(result.laborCostRatio != null ? [`占比 ${Math.round(result.laborCostRatio * 100)}%`] : []),
        ...(result.incrementalRoi != null ? [`ROI ${result.incrementalRoi}`] : []),
      ]}
      nextStep={result.nextStep}
      opinions={[result.orgOpinion, result.financeOpinion]}
      blockers={result.blockers}
      collaborators={[{ name: HUBU_FINANCE_CAPABILITY.owner, accent: HUBU_FINANCE_CAPABILITY.accent, note: '帮算成本占比' }]}
      sourceNote="LOCAL · 编制/成本占比本地计算（铁律9）；营收可由户部填"
    />
  );
}
