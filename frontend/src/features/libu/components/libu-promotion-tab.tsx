'use client';

import { useRef, useState } from 'react';
import { BadgeCheck, Plus, Trash2 } from 'lucide-react';

import {
  parsePromotionRows,
  type PromotionReview,
} from '@/features/libu/lib/promotion-review';
import { ACCENT } from '@/features/libu/lib/libu-roster';
import { INPUT_BASE, bdr, PromotionResult } from './libu-hr-shared';

interface PromoDim {
  _id: string;
  dimension: string;
  maxScore: number;
  score: number | '';
}

export function PromotionTab() {
  const counter = useRef(0);

  function mkDim(): PromoDim {
    return { _id: `d-${++counter.current}`, dimension: '', maxScore: 20, score: '' };
  }

  const [candidate, setCandidate] = useState('');
  const [dims, setDims] = useState<PromoDim[]>(() => [mkDim(), mkDim(), mkDim()]);
  const [result, setResult] = useState<PromotionReview | null>(null);

  function addDim() {
    setDims((d) => [...d, mkDim()]);
  }

  function updateDim(idx: number, updated: PromoDim) {
    setDims((d) => d.map((row, i) => (i === idx ? updated : row)));
  }

  function removeDim(idx: number) {
    if (dims.length <= 1) return;
    setDims((d) => d.filter((_, i) => i !== idx));
  }

  function analyse() {
    if (!candidate.trim()) return;
    const headerRow = ['评价维度', '满分', '评分'];
    const dataRows = dims
      .filter((d) => d.dimension.trim())
      .map((d) => [d.dimension, d.maxScore, d.score === '' ? null : d.score]);
    const rows = [headerRow, ...dataRows] as unknown[][];
    setResult(parsePromotionRows(rows, candidate));
  }

  const canAnalyse = candidate.trim() && dims.some((d) => d.dimension.trim());

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-[20px] border px-4 pt-4 pb-3"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <BadgeCheck size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">
            铨叙司 · 转正评估
          </span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        <input
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
          placeholder="候选人姓名"
          className={`${INPUT_BASE} mb-3`}
          style={bdr()}
        />

        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_72px_72px_28px] gap-1.5 text-[10px] text-[#5a6070]">
            <span>评价维度</span>
            <span className="text-center">满分</span>
            <span className="text-center">评分</span>
            <span />
          </div>
          {dims.map((dim, idx) => (
            <div
              key={dim._id}
              className="grid grid-cols-[1fr_72px_72px_28px] items-center gap-1.5"
            >
              <input
                value={dim.dimension}
                onChange={(e) => updateDim(idx, { ...dim, dimension: e.target.value })}
                placeholder={`维度${idx + 1}`}
                className={INPUT_BASE}
                style={bdr()}
              />
              <input
                type="number"
                min={1}
                value={dim.maxScore}
                onChange={(e) =>
                  updateDim(idx, { ...dim, maxScore: Math.max(1, Number(e.target.value)) })
                }
                className={INPUT_BASE}
                style={bdr()}
              />
              <input
                type="number"
                min={0}
                value={dim.score}
                onChange={(e) =>
                  updateDim(idx, {
                    ...dim,
                    score: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)),
                  })
                }
                placeholder="—"
                className={INPUT_BASE}
                style={bdr()}
              />
              <button
                type="button"
                onClick={() => removeDim(idx)}
                disabled={dims.length <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#4a5060] transition hover:text-[#E5604D] disabled:opacity-30"
                aria-label="删除"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addDim}
            className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[11.5px] text-[#b6ab8c] transition hover:text-[#F5E9C9] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#A99CF0]"
            style={{ borderColor: `${ACCENT}28` }}
          >
            <Plus size={12} /> 加评分维度
          </button>

          <button
            type="button"
            onClick={analyse}
            disabled={!canAnalyse}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: ACCENT, color: '#040A10' }}
          >
            <BadgeCheck size={14} />
            评估转正
          </button>

          <span className="ml-auto text-[10px] text-[#5f5a48]">
            LOCAL · 缺评分标缺，不替打分
          </span>
        </div>
      </div>

      {result && <PromotionResult result={result} />}

      {!result && (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <BadgeCheck size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">填入候选人和评分维度，点「评估转正」</p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">
            多维度评分 → 准予/延续/不予转正（缺评分不替打）
          </p>
        </div>
      )}
    </div>
  );
}
