'use client';

import { useState } from 'react';
import { VerdictCard } from '@/features/shared/office-kit/verdict-card';
import { evaluateOffer, type OfferDecision } from '@/features/lifu/lib/lifu-negotiation';
import { checkFidelity, type FidelityResult } from '@/features/lifu/lib/lifu-fidelity';
import {
  requestLifuComplianceReport,
  type LipuComplianceOutcome,
  type LipuHardGateLight,
} from '@/features/lifu/api/lifu-compliance';
import type { SourceLabel } from '@/core/courtos/types';
import { VERDICT_TONE, inputClass } from './verdict-tone';

const SOURCE_LABELS: SourceLabel[] = ['LIVE', 'LIVE_SWARM', 'MIXED', 'FALLBACK', 'DEMO'];
const OFFER_VERDICT_CN: Record<OfferDecision['decision'], string> = { accept: '可接受', counter: '还价', walk: '走人' };
const OFFER_VERDICT_COLOR: Record<OfferDecision['decision'], keyof typeof VERDICT_TONE> = { accept: 'green', counter: 'amber', walk: 'red' };
const HARD_LIGHT_CN: Record<LipuHardGateLight, string> = { green: '硬闸绿灯', yellow: '硬闸黄灯', red: '硬闸红灯', black: '硬闸黑灯' };
const HARD_LIGHT_TONE: Record<LipuHardGateLight, keyof typeof VERDICT_TONE> = { green: 'green', yellow: 'amber', red: 'red', black: 'red' };

function ComplianceReportSection() {
  const [taskInput, setTaskInput] = useState('');
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<LipuComplianceOutcome | null>(null);

  async function run() {
    const text = taskInput.trim();
    if (!text) return;
    setRunning(true);
    setOutcome(null);
    const next = await requestLifuComplianceReport(text);
    setOutcome(next);
    setRunning(false);
  }

  const report = outcome?.status === 'success' ? outcome.report : null;

  return (
    <div className="space-y-3">
      <div>
        <span className="text-[11px] font-bold tracking-[0.14em] text-[#8a9aaa]">真实合规三源会审</span>
        <p className="mt-1 text-[11px] text-[#657080]">
          提交待发布任务；红黄绿黑四灯只取礼部素材回链硬闸，LLM 复核和舆情源仅作软意见。
        </p>
      </div>
      <label className="block text-[11px] text-[#8a9aaa]">
        待审核任务 / 对外文案
        <textarea
          value={taskInput}
          onChange={(event) => { setTaskInput(event.target.value); setOutcome(null); }}
          placeholder="例如：请基于以下已知素材生成并核验发布稿……"
          className={`${inputClass} mt-1 min-h-24`}
          disabled={running}
        />
      </label>
      <button
        type="button"
        onClick={() => void run()}
        disabled={running || taskInput.trim().length === 0}
        className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[#C070D0]/35 bg-[#C070D0]/12 px-3 text-[11.5px] font-semibold text-[#E2B8EE] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {running ? '真实引擎审核中…' : '提交礼部合规审核'}
      </button>

      {outcome?.status === 'fallback' && (
        <div className="rounded-[12px] border border-[#FF8A8A]/30 bg-[#FF8A8A]/8 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#FF8A8A]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF8A8A]">{outcome.sourceLabel}</span>
            <span className="text-[11.5px] text-[#d49a9a]">真实礼部引擎未返回结果</span>
          </div>
          <p className="mt-1.5 text-[11px] text-[#8a6f78]">{outcome.error}</p>
        </div>
      )}

      {report && (
        <div className="space-y-2.5">
          <VerdictCard
            verdictCn={HARD_LIGHT_CN[report.light]}
            cfg={VERDICT_TONE[HARD_LIGHT_TONE[report.light]]}
            title={report.headline || '礼部素材回链硬闸'}
            nextStep="此灯为最终合规判定；两路软意见不会覆盖它。"
            opinions={report.items.map((item) => `${item.title}${item.fix ? ` · 修正：${item.fix}` : ''}`)}
            sourceNote={`${report.source_label} · lipu_vet 确定性硬闸`}
          />

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-[12px] border border-white/10 bg-white/[0.025] px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] font-semibold text-[#F5E9C9]">合规复核软意见</span>
                {report.review_opinion && <span className="text-[10px] text-[#86A9F2]">{report.review_opinion.source_label}</span>}
              </div>
              <p className="mt-1.5 text-[11px] text-[#8a9aaa]">{report.review_opinion?.text ?? '该源未产出。'}</p>
            </div>
            <div className="rounded-[12px] border border-white/10 bg-white/[0.025] px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] font-semibold text-[#F5E9C9]">舆情监测软意见</span>
                {report.xhs_monitor_opinion && <span className="text-[10px] text-[#86A9F2]">{report.xhs_monitor_opinion.source_label}</span>}
              </div>
              <p className="mt-1.5 text-[11px] text-[#8a9aaa]">{report.xhs_monitor_opinion?.text ?? '该源未关联。'}</p>
            </div>
          </div>

          {report.missing_coverage.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {report.missing_coverage.map((gap) => (
                <span key={gap} className="rounded-[6px] border border-dashed border-[#F0C66A]/25 px-2 py-1 text-[10px] text-[#bfa764]">⚠ {gap}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
      <ComplianceReportSection />
      <OfferSection />
      <FidelitySection />
    </div>
  );
}
