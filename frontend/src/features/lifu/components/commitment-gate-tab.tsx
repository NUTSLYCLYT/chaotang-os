'use client';

import { useState } from 'react';
import { VerdictCard } from '@/features/shared/office-kit/verdict-card';
import { evaluateOffer, type OfferDecision } from '@/features/lifu/lib/lifu-negotiation';
import { checkFidelity, type FidelityResult } from '@/features/lifu/lib/lifu-fidelity';
import type { SourceLabel } from '@/core/courtos/types';
import { VERDICT_TONE, inputClass } from './verdict-tone';

const SOURCE_LABELS: SourceLabel[] = ['LIVE', 'LIVE_SWARM', 'MIXED', 'FALLBACK', 'DEMO'];
const OFFER_VERDICT_CN: Record<OfferDecision['decision'], string> = { accept: '可接受', counter: '还价', walk: '走人' };
const OFFER_VERDICT_COLOR: Record<OfferDecision['decision'], keyof typeof VERDICT_TONE> = { accept: 'green', counter: 'amber', walk: 'red' };

function OfferSection() {
  const [ownReservation, setOwnReservation] = useState(0);
  const [counterpartReservation, setCounterpartReservation] = useState<number | ''>('');
  const [offer, setOffer] = useState(0);
  const [betterWhenHigher, setBetterWhenHigher] = useState(true);
  const [result, setResult] = useState<OfferDecision | null>(null);

  function run() {
    setResult(evaluateOffer({
      ownReservation,
      counterpartReservation: counterpartReservation === '' ? undefined : counterpartReservation,
      offer,
      betterWhenHigher,
    }));
  }

  return (
    <div className="space-y-3">
      <span className="text-[11px] font-bold tracking-[0.14em] text-[#8a9aaa]">报价/让步评估</span>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <label className="block text-[11px] text-[#8a9aaa]">
          己方保留价
          <input type="number" min={0} value={ownReservation} onChange={(e) => { setOwnReservation(Number(e.target.value || 0)); setResult(null); }} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-[11px] text-[#8a9aaa]">
          对方保留价(估,可缺)
          <input type="number" min={0} value={counterpartReservation} onChange={(e) => { setCounterpartReservation(e.target.value === '' ? '' : Number(e.target.value)); setResult(null); }} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-[11px] text-[#8a9aaa]">
          当前报价
          <input type="number" min={0} value={offer} onChange={(e) => { setOffer(Number(e.target.value || 0)); setResult(null); }} className={`${inputClass} mt-1`} />
        </label>
        <label className="flex items-center gap-2 pt-5 text-[11px] text-[#8a9aaa]">
          <input type="checkbox" checked={betterWhenHigher} onChange={(e) => { setBetterWhenHigher(e.target.checked); setResult(null); }} />
          越高越好(卖方)
        </label>
      </div>
      <button
        type="button"
        onClick={run}
        className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[#C070D0]/35 bg-[#C070D0]/12 px-3 text-[11.5px] font-semibold text-[#E2B8EE] transition hover:brightness-110"
      >
        算报价决策
      </button>
      {result && (
        <VerdictCard
          verdictCn={OFFER_VERDICT_CN[result.decision]}
          cfg={VERDICT_TONE[OFFER_VERDICT_COLOR[result.decision]]}
          title="本次报价"
          metrics={[
            result.zopaExists != null ? `ZOPA ${result.zopaExists ? '有' : '无'}` : 'ZOPA 未知',
            result.surplus != null ? `空间 ${result.surplus}` : '',
          ].filter(Boolean)}
          nextStep={result.reason}
          blockers={result.needsSignoff ? ['对外承诺需人工签字,不一键静默'] : []}
          opinions={result.humanJudged}
          sourceNote="LOCAL · 对外承诺可逆司 · BATNA/保留价为人工裁量"
        />
      )}
    </div>
  );
}

function FidelitySection() {
  const [sourceLabel, setSourceLabel] = useState<SourceLabel>('MIXED');
  const [risksText, setRisksText] = useState('');
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<FidelityResult | null>(null);

  function run() {
    const risks = risksText.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
    setResult(checkFidelity({ sourceLabel, risks }, expression));
  }

  return (
    <div className="space-y-3 border-t border-white/8 pt-3">
      <span className="text-[11px] font-bold tracking-[0.14em] text-[#8a9aaa]">对外表达防失真检查</span>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="block text-[11px] text-[#8a9aaa]">
          源结论标签
          <select value={sourceLabel} onChange={(e) => { setSourceLabel(e.target.value as SourceLabel); setResult(null); }} className={`${inputClass} mt-1`}>
            {SOURCE_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="block text-[11px] text-[#8a9aaa]">
          源带的风险/缺证(逗号分隔)
          <input value={risksText} onChange={(e) => { setRisksText(e.target.value); setResult(null); }} className={`${inputClass} mt-1`} />
        </label>
      </div>
      <label className="block text-[11px] text-[#8a9aaa]">
        对外表达文案
        <textarea value={expression} onChange={(e) => { setExpression(e.target.value); setResult(null); }} className={`${inputClass} mt-1 min-h-16`} />
      </label>
      <button
        type="button"
        onClick={run}
        className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[#C070D0]/35 bg-[#C070D0]/12 px-3 text-[11.5px] font-semibold text-[#E2B8EE] transition hover:brightness-110"
      >
        查失真
      </button>
      {result && (
        <VerdictCard
          verdictCn={result.faithful ? '忠于源结论' : `${result.violations.length} 处失真`}
          cfg={result.faithful ? VERDICT_TONE.green : VERDICT_TONE.red}
          title="对外表达"
          nextStep={result.faithful ? '可对外发出' : '按下列问题修改后再发'}
          opinions={result.violations}
          sourceNote="LOCAL · 防失真门 · 不自动放行,失真项须人工复核"
        />
      )}
    </div>
  );
}

export function CommitmentGateTab() {
  return (
    <div className="space-y-5">
      <OfferSection />
      <FidelitySection />
    </div>
  );
}
