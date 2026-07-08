'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

import {
  buildCompBand,
  suggestOffer,
  type CandidateTier,
} from '@/features/libu/lib/compensation-band';
import { ACCENT } from '@/features/libu/lib/libu-roster';
import { INPUT_BASE, bdr, CompResultPanel, type CompResult } from './libu-hr-shared';

const TIER_OPTIONS: { value: CandidateTier; label: string }[] = [
  { value: 'junior',     label: '新人（25-50分位）' },
  { value: 'experienced',label: '有经验（50分位）' },
  { value: 'expert',     label: '专家（50-75分位）' },
];

interface CompForm {
  level: string;
  marketMid: number | '';
  bandWidth: number;
  tier: CandidateTier;
}

const INIT_COMP: CompForm = { level: '', marketMid: '', bandWidth: 0.2, tier: 'experienced' };

export function CompensationTab() {
  const [form, setForm] = useState<CompForm>(INIT_COMP);
  const [result, setResult] = useState<CompResult | null>(null);

  function analyse() {
    if (!form.level.trim()) return;
    const band = buildCompBand(form.level, form.marketMid === '' ? null : form.marketMid, form.bandWidth);
    const offer = suggestOffer(band, form.tier);
    setResult({ band, offer });
  }

  function upd<K extends keyof CompForm>(k: K, v: CompForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-[20px] border px-4 pt-4 pb-3"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">
            薪酬司 · 宽带薪酬 + 定薪建议
          </span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        <div className="space-y-2">
          <input
            value={form.level}
            onChange={(e) => upd('level', e.target.value)}
            placeholder="岗位/级别（如：后端工程师 L3）"
            className={INPUT_BASE}
            style={bdr()}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#6a7080]">市场中位月薪（元）</label>
              <input
                type="number"
                min={0}
                value={form.marketMid}
                onChange={(e) =>
                  upd('marketMid', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
                }
                placeholder="如 20000"
                className={`${INPUT_BASE} mt-0.5`}
                style={bdr()}
              />
            </div>
            <div>
              <label className="text-[10px] text-[#6a7080]">带宽（±比例，默认0.2）</label>
              <input
                type="number"
                min={0.05}
                max={0.5}
                step={0.05}
                value={form.bandWidth}
                onChange={(e) =>
                  upd('bandWidth', Math.max(0.05, Math.min(0.5, Number(e.target.value))))
                }
                className={`${INPUT_BASE} mt-0.5`}
                style={bdr()}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#6a7080]">候选人层次（影响定薪分位）</label>
            <select
              value={form.tier}
              onChange={(e) => upd('tier', e.target.value as CandidateTier)}
              className={`${INPUT_BASE} mt-0.5`}
              style={bdr()}
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value} style={{ background: '#0e1220' }}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={analyse}
            disabled={!form.level.trim()}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: ACCENT, color: '#040A10' }}
          >
            <TrendingUp size={14} />
            算薪酬带
          </button>
          <span className="ml-auto text-[10px] text-[#5f5a48]">
            LOCAL · 市场中位±{Math.round(form.bandWidth * 100)}% 带宽
          </span>
        </div>
      </div>

      {result && <CompResultPanel result={result} />}

      {!result && (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <TrendingUp size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">填入岗位和市场中位，点「算薪酬带」</p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">
            宽带薪酬（min/中位/max）+ 按经验层次定薪分位
          </p>
        </div>
      )}
    </div>
  );
}
