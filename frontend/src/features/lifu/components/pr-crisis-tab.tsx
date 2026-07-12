'use client';

import { useState } from 'react';
import { VerdictCard } from '@/features/shared/office-kit/verdict-card';
import { crisisResponse, type CrisisCluster, type CrisisResponse } from '@/features/lifu/lib/lifu-crisis';
import { VERDICT_TONE, JINYIWEI_ACCENT, inputClass } from './verdict-tone';

const CLUSTER_CN: Record<CrisisCluster, string> = { victim: '受害型(外部致因)', accidental: '意外型(技术/流程failure)', preventable: '可预防型(管理失职)' };
const POSTURE_CN: Record<CrisisResponse['posture'], string> = { deny: '否认', diminish: '淡化', rebuild: '重建姿态' };
const TIER_TONE: Record<CrisisResponse['severityTier'], keyof typeof VERDICT_TONE> = { 1: 'green', 2: 'blue', 3: 'amber', 4: 'red' };

export function PrCrisisTab() {
  const [cluster, setCluster] = useState<CrisisCluster>('accidental');
  const [priorCrisisHistory, setPriorCrisisHistory] = useState(false);
  const [reach, setReach] = useState(0.5);
  const [harm, setHarm] = useState(0.5);
  const [legalRisk, setLegalRisk] = useState(0.2);
  const [velocity, setVelocity] = useState(0.5);
  const [result, setResult] = useState<CrisisResponse | null>(null);

  function run() {
    setResult(crisisResponse({ cluster, priorCrisisHistory, reach, harm, legalRisk, velocity }));
  }

  return (
    <div className="space-y-4">
      <span className="text-[12px] font-bold tracking-[0.14em] text-[#F5E9C9]">危机响应姿态</span>

      <label className="block text-[11px] text-[#8a9aaa]">
        危机簇(人工判断,归责越重越靠可预防型)
        <select value={cluster} onChange={(e) => { setCluster(e.target.value as CrisisCluster); setResult(null); }} className={`${inputClass} mt-1`}>
          {Object.entries(CLUSTER_CN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-2 text-[11px] text-[#8a9aaa]">
        <input type="checkbox" checked={priorCrisisHistory} onChange={(e) => { setPriorCrisisHistory(e.target.checked); setResult(null); }} />
        有同类前科
      </label>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SliderField label="影响范围 reach" value={reach} onChange={(v) => { setReach(v); setResult(null); }} />
        <SliderField label="伤害程度 harm" value={harm} onChange={(v) => { setHarm(v); setResult(null); }} />
        <SliderField label="法律风险 legalRisk" value={legalRisk} onChange={(v) => { setLegalRisk(v); setResult(null); }} />
        <SliderField label="扩散速度 velocity" value={velocity} onChange={(v) => { setVelocity(v); setResult(null); }} />
      </div>

      <button
        type="button"
        onClick={run}
        className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#C070D0]/35 bg-[#C070D0]/12 px-4 text-[12px] font-semibold text-[#E2B8EE] transition hover:brightness-110"
      >
        算响应姿态
      </button>

      {result && (
        <VerdictCard
          verdictCn={`${POSTURE_CN[result.posture]} · Tier ${result.severityTier}`}
          cfg={VERDICT_TONE[TIER_TONE[result.severityTier]]}
          title="本次危机"
          metrics={[`SLA ${result.sla}`, result.needsSignoff ? '需签字' : '无需签字']}
          nextStep={`通知序列：${result.notify.join(' → ')}`}
          blockers={result.needsSignoff ? ['高严重度,发出前需人工签字'] : []}
          opinions={[result.postureReason, ...result.humanJudged]}
          collaborators={[{ name: '锦衣卫', accent: JINYIWEI_ACCENT, note: '舆情监测调锦衣卫,本司不自采' }]}
          sourceNote="LOCAL · 商务公关司 · 危机簇/严重度为人工裁量输入"
        />
      )}
    </div>
  );
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-[11px] text-[#8a9aaa]">
      {label} · {value.toFixed(2)}
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[#C070D0]" />
    </label>
  );
}
