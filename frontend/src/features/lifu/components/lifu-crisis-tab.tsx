'use client';

/**
 * 礼部商务公关司 · 危机响应工作台
 *
 * 接通 lifu-crisis.ts crisisResponse() 纯函数引擎。
 * 诚实标注：危机簇是人工裁量（humanJudged）；tier≥3 显示 needsSignoff。
 * LOCAL —— 数据不出浏览器。
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';

import {
  crisisResponse,
  type CrisisCluster,
  type CrisisPosture,
  type CrisisResponse,
} from '@/features/lifu/lib/lifu-crisis';
import { ACCENT } from '@/features/lifu/lib/lifu-roster';

// ── 常量 ──────────────────────────────────────────────────────────────────────

const CLUSTER_OPTIONS: { value: CrisisCluster; label: string; desc: string }[] = [
  { value: 'victim', label: '受害者型', desc: '外部攻击/天灾，企业受害方' },
  { value: 'accidental', label: '意外事故型', desc: '非故意失误，归责较轻' },
  { value: 'preventable', label: '可预防型', desc: '企业有责任，需主动承担' },
];

const POSTURE_LABEL: Record<CrisisPosture, string> = {
  deny: '否认',
  diminish: '淡化',
  rebuild: '重建',
};

const POSTURE_DESC: Record<CrisisPosture, string> = {
  deny: '否认企业关联——适用于受害者型，且无前科',
  diminish: '淡化责任——承认事件但降低归因',
  rebuild: '重建信誉——主动承担、补偿受害方',
};

const TIER_COLOR: Record<number, string> = {
  1: '#9aa0ad',
  2: '#E5B84D',
  3: '#E5A040',
  4: '#E5604D',
};

const TIER_LABEL: Record<number, string> = {
  1: '轻微',
  2: '中度',
  3: '严重',
  4: '极端',
};

// ── 子组件 ────────────────────────────────────────────────────────────────────

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-[#6a7080]">{label}</label>
        <span className="font-mono text-[10px] text-[#b6ab8c]">{value.toFixed(2)}</span>
      </div>
      {/* accent-[#C070D0] — 静态字面量，JIT 可扫到 */}
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 w-full accent-[#C070D0] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C070D0]"
      />
    </div>
  );
}

function CrisisResultPanel({ r }: { r: CrisisResponse }) {
  const tierColor = TIER_COLOR[r.severityTier];
  const needsSignoff = r.needsSignoff;

  return (
    <div
      className="rounded-[20px] border p-4"
      style={{ borderColor: `${ACCENT}28`, background: `${ACCENT}06` }}
    >
      {/* 姿态行 */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <CheckCircle2 size={14} style={{ color: ACCENT }} />
        <span className="text-[13px] font-semibold text-[#F5E9C9]">
          危机响应方案
        </span>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px]"
          style={{ borderColor: `${ACCENT}30`, color: `${ACCENT}cc` }}
        >
          LOCAL · SCCT
        </span>
      </div>

      {/* 姿态 + Tier 双列 */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        {/* 姿态 */}
        <div
          className="rounded-[12px] border px-3 py-2.5"
          style={{ borderColor: `${ACCENT}28`, background: `${ACCENT}0c` }}
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8f835f]">响应姿态</div>
          <div className="mt-1 text-[20px] font-bold" style={{ color: ACCENT }}>
            {POSTURE_LABEL[r.posture]}
          </div>
          <div className="mt-1 text-[10.5px] text-[#8a9aaa]">
            {POSTURE_DESC[r.posture]}
          </div>
          <div className="mt-1.5 text-[10px] text-[#5a6070]">{r.postureReason}</div>
        </div>

        {/* 严重度 Tier */}
        <div
          className="rounded-[12px] border px-3 py-2.5"
          style={{ borderColor: `${tierColor}38`, background: `${tierColor}0d` }}
        >
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: `${tierColor}88` }}>
            严重度 Tier
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[28px] font-bold leading-none" style={{ color: tierColor }}>
              {r.severityTier}
            </span>
            <span className="text-[13px]" style={{ color: `${tierColor}cc` }}>
              {TIER_LABEL[r.severityTier]}
            </span>
          </div>
          <div className="mt-1.5 text-[11px]" style={{ color: `${tierColor}aa` }}>
            {r.sla}
          </div>
          {needsSignoff && (
            <div
              className="mt-2 flex items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[10.5px] font-semibold"
              style={{ borderColor: '#E5604D50', color: '#E5604D', background: '#E5604D0e' }}
            >
              <ShieldAlert size={11} />
              需人工签字 needsSignoff
            </div>
          )}
        </div>
      </div>

      {/* 通知序列 */}
      <div
        className="mb-3 rounded-[12px] border px-3 py-2"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.45)' }}
      >
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[#8f835f]">
          通知序列（Tier {r.severityTier}）
        </div>
        <div className="flex flex-wrap gap-2">
          {r.notify.map((n, idx) => (
            <span
              key={`notify-${idx}`}
              className="rounded-[6px] border px-2 py-0.5 text-[11px]"
              style={{ borderColor: `${ACCENT}28`, color: `${ACCENT}cc`, background: `${ACCENT}0c` }}
            >
              {idx + 1}. {n}
            </span>
          ))}
        </div>
      </div>

      {/* humanJudged 警示 */}
      <div
        className="rounded-[10px] border border-dashed px-3 py-2"
        style={{ borderColor: '#E5B84D28', background: '#E5B84D06' }}
      >
        <div className="mb-1 flex items-center gap-1.5 text-[10px]" style={{ color: '#E5B84D99' }}>
          <AlertTriangle size={10} />
          humanJudged 人工裁量字段
        </div>
        <div className="space-y-0.5">
          {r.humanJudged.map((h, idx) => (
            <div key={`hj-${idx}`} className="text-[10.5px]" style={{ color: '#E5B84D88' }}>
              · {h}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 主 Tab 组件 ────────────────────────────────────────────────────────────────

export function CrisisTab() {
  const [cluster, setCluster] = useState<CrisisCluster>('victim');
  const [priorHistory, setPriorHistory] = useState(false);
  const [reach, setReach] = useState(0.3);
  const [harm, setHarm] = useState(0.3);
  const [legalRisk, setLegalRisk] = useState(0.2);
  const [velocity, setVelocity] = useState(0.2);
  const [result, setResult] = useState<CrisisResponse | null>(null);
  const [running, setRunning] = useState(false);

  function analyse() {
    setRunning(true);
    setTimeout(() => {
      setResult(
        crisisResponse({ cluster, priorCrisisHistory: priorHistory, reach, harm, legalRisk, velocity }),
      );
      setRunning(false);
    }, 0);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 输入区 */}
      <div
        className="rounded-[20px] border px-4 pt-4 pb-3"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">
            商务公关司 · 危机响应
          </span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        {/* 危机簇选择 */}
        <div className="mb-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[#8f835f]">
            危机簇（人工判断·归责越重越靠可预防型）
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CLUSTER_OPTIONS.map((opt) => {
              const active = cluster === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCluster(opt.value)}
                  className="rounded-[10px] border px-3 py-2 text-left transition"
                  style={{
                    borderColor: active ? `${ACCENT}60` : '#ffffff14',
                    background: active ? `${ACCENT}18` : 'rgba(6,8,14,0.35)',
                    color: active ? ACCENT : '#6a7080',
                  }}
                >
                  <div className="text-[12px] font-semibold">{opt.label}</div>
                  <div className="mt-0.5 text-[10px]" style={{ color: active ? `${ACCENT}99` : '#4a5060' }}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 前科勾选 */}
        <div className="mb-3">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={priorHistory}
              onChange={(e) => setPriorHistory(e.target.checked)}
              className="accent-[#C070D0] h-3.5 w-3.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C070D0]"
            />
            <span className="text-[12px] text-[#b6ab8c]">
              有同类危机前科（有前科 → 姿态升级更负责）
            </span>
          </label>
        </div>

        {/* 四维 0-1 滑块 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SliderField label="波及范围 reach" value={reach} onChange={setReach} />
          <SliderField label="实际伤害 harm" value={harm} onChange={setHarm} />
          <SliderField label="法律风险 legalRisk" value={legalRisk} onChange={setLegalRisk} />
          <SliderField label="传播速度 velocity" value={velocity} onChange={setVelocity} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={analyse}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: running ? `${ACCENT}30` : ACCENT,
              color: running ? ACCENT : '#040A10',
            }}
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            {running ? '分析中…' : '生成响应方案'}
          </button>

          <span className="ml-auto text-[10px] text-[#5f5a48]">
            LOCAL · SCCT(Coombs 2007) · 危机簇人工判断
          </span>
        </div>
      </div>

      {/* 结果区 */}
      {result && <CrisisResultPanel r={result} />}

      {/* 空状态 */}
      {!result && !running && (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <AlertTriangle size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">选择危机簇，调整四维评估，点「生成响应方案」</p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">
            SCCT 姿态 + 严重度 Tier 1-4 + 通知序列
          </p>
        </div>
      )}
    </div>
  );
}
