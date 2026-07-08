'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Brain, Shield, Zap, Building2, Loader2, ArrowRight, Clock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { TypewriterText } from '@/components/effects';
import type { ManorAnalyzeResult } from '@/types/manor';

const DEPT_LABELS: Record<string, string> = {
  xingbu: '刑部',
  libu_hr: '吏部',
  hubu: '户部',
  libu: '礼部',
  gongbu: '工部',
  bingbu: '兵部',
  shangshu: '尚书省',
  zhongshu: '中书省',
};

const DOMAIN_LABELS: Record<string, string> = {
  legal: '律师庄园',
  hr: 'HR 庄园',
  finance: '财务庄园',
  ecommerce: '电商庄园',
  ops: '运维庄园',
  compliance: '合规庄园',
  sales: '销售庄园',
  marketing: '营销庄园',
  battery_pack: '电池Pack庄园',
  'supply-chain': '供应链庄园',
  investment: '投资庄园',
};

const LIGHT_STYLES: Record<string, string> = {
  green: 'border-[#3DD68C]/30 bg-[#3DD68C]/8 text-[#3DD68C]',
  yellow: 'border-[#F0C66A]/30 bg-[#F0C66A]/8 text-[#F0C66A]',
  red: 'border-[#F58B8B]/30 bg-[#F58B8B]/8 text-[#F58B8B]',
};

interface ManorResultPanelProps {
  result: ManorAnalyzeResult | null;
  loading: boolean;
  error: string | null;
  taskId?: string | null;
}

const TIMEOUT_WARN_AT = 8;
const TIMEOUT_TOTAL = 12;

function useTimeoutCountdown(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      if (ref.current) clearInterval(ref.current);
      return;
    }
    ref.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [active]);

  return elapsed;
}

export function ManorResultPanel({ result, loading, error, taskId }: ManorResultPanelProps) {
  const [summaryDone, setSummaryDone] = useState(false);
  const [risksDone, setRisksDone] = useState(false);
  const elapsed = useTimeoutCountdown(loading);
  const showWarning = loading && elapsed >= TIMEOUT_WARN_AT;
  const remaining = Math.max(0, TIMEOUT_TOTAL - elapsed);

  if (!loading && !result && !error) return null;

  return (
    <GlassPanel tone="elevated" padding="lg" hudCorners className="mb-4">
      <div className="mb-3 flex items-center gap-2">
        <Brain size={13} className="text-[#8AA4FF]" />
        <div className="text-[11px] uppercase tracking-wider text-[#6A7299]">
          Manor Intelligence · 庄园研判回执
        </div>
        {result && (
          <span className="ml-auto rounded-full border border-[#8AA4FF]/20 bg-[#8AA4FF]/10 px-2 py-0.5 font-mono text-[11px] text-[#8AA4FF]">
            {DOMAIN_LABELS[result.domain] ?? result.domain}
          </span>
        )}
      </div>

      {loading && !showWarning && (
        <div className="flex items-center gap-3 py-4 text-[12px] text-[#9AA3C4]">
          <Loader2 size={14} className="animate-spin text-[#8AA4FF]" />
          正在召见庄园幕僚，研判中...
        </div>
      )}

      {loading && showWarning && (
        <div className="flex items-center gap-3 rounded-lg border border-[#F0C66A]/25 bg-[#F0C66A]/8 px-4 py-3">
          <Clock size={14} className="shrink-0 text-[#F0C66A]" />
          <div className="text-[12px] text-[#F0C66A]">
            庄园响应较慢，剩余等待 {remaining}s...
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-[#F58B8B]/20 bg-[#F58B8B]/8 px-4 py-3 text-[11px] text-[#F58B8B]">
          庄园暂时无响应，任务已创建，稍后可在复盘台查阅。
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#8AA4FF]/15 bg-[#8AA4FF]/[0.04] px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-[#5A6280]">中枢研判</div>
            <div className="mt-1.5 text-[14px] font-semibold leading-6 text-[#EAEEFB]">
              <TypewriterText
                text={result.summary}
                charDelayMs={40}
                startDelayMs={200}
                onDone={() => setSummaryDone(true)}
              />
            </div>
          </div>

          <div
            className="grid grid-cols-1 gap-3 md:grid-cols-2 transition-opacity duration-500"
            style={{ opacity: summaryDone ? 1 : 0 }}
          >
            {result.risks.slice(0, 2).map((risk, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#F58B8B]/20 bg-[#F58B8B]/[0.04] px-3 py-2.5"
              >
                <div className="flex items-center gap-1.5">
                  <Shield
                    size={11}
                    className={risk.level === 'high' ? 'text-[#F58B8B]' : 'text-[#F0C66A]'}
                  />
                  <span className="text-[11px] uppercase tracking-wider text-[#6A7299]">
                    {risk.level === 'high' ? '高风险' : '中风险'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] leading-5 text-[#C8CDD8]">{risk.title}</div>
              </div>
            ))}
          </div>

          {result.action_cards.length > 0 && (
            <div
              className="transition-opacity duration-500"
              style={{ opacity: summaryDone ? 1 : 0 }}
              onTransitionEnd={() => setRisksDone(true)}
            >
              <div className="mb-2 text-[11px] uppercase tracking-wider text-[#5A6280]">
                <Zap size={9} className="mr-1 inline" />
                行动卡片
              </div>
              <div
                className="flex flex-wrap gap-2 transition-opacity duration-500"
                style={{ opacity: risksDone ? 1 : 0 }}
              >
                {result.action_cards.map((card, i) => (
                  <div
                    key={i}
                    className={`rounded-full border px-3 py-1 text-[11px] ${LIGHT_STYLES[card.light] ?? LIGHT_STYLES.yellow}`}
                  >
                    {card.title}
                    <span className="ml-1.5 opacity-60">{card.when}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.requires_departments.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1.5 transition-opacity duration-500"
              style={{ opacity: risksDone ? 1 : 0 }}
            >
              <Building2 size={11} className="text-[#6A7299]" />
              <span className="text-[11px] uppercase tracking-wider text-[#5A6280]">需协同</span>
              {result.requires_departments.map((dept) => (
                <span
                  key={dept}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-[#9AA3C4]"
                >
                  {DEPT_LABELS[dept] ?? dept}
                </span>
              ))}
            </div>
          )}

          {taskId && (
            <div
              className="flex justify-end pt-1 transition-opacity duration-500"
              style={{ opacity: summaryDone ? 1 : 0 }}
            >
              <Link
                href={`/scribe/${taskId}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#8AA4FF]/30 bg-[#8AA4FF]/10 px-3 py-1.5 text-[11px] text-[#8AA4FF] transition hover:bg-[#8AA4FF]/18"
              >
                查看完整呈报
                <ArrowRight size={11} />
              </Link>
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  );
}
