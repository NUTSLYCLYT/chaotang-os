'use client';

/**
 * 礼部对外承诺司 · 谈判评估工作台
 *
 * 接通 lifu-negotiation.ts evaluateOffer() 纯函数引擎。
 * 诚实标注：BATNA/保留价是人工裁量（humanJudged）；对外承诺恒定 needsSignoff。
 * LOCAL —— 数据不出浏览器。
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Scale } from 'lucide-react';

import {
  evaluateOffer,
  type OfferDecision,
} from '@/features/lifu/lib/lifu-negotiation';
import { ACCENT } from '@/features/lifu/lib/lifu-roster';

// ── 常量 ──────────────────────────────────────────────────────────────────────

const DECISION_CONFIG: Record<
  OfferDecision['decision'],
  { label: string; color: string; bg: string; border: string }
> = {
  accept: { label: '接受', color: '#3DD68C', bg: '#3DD68C0d', border: '#3DD68C30' },
  counter: { label: '还价', color: '#E5B84D', bg: '#E5B84D0e', border: '#E5B84D34' },
  walk: { label: '走人', color: '#E5604D', bg: '#E5604D12', border: '#E5604D3a' },
};

// ── 输入框样式 helper ─────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-[8px] border bg-transparent px-2.5 py-1.5 text-[11.5px] text-[#E9DDBE] placeholder:text-[#3a3e4c] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C070D0]';

// ── 结果面板 ──────────────────────────────────────────────────────────────────

function NegotiationResultPanel({ r }: { r: OfferDecision }) {
  const cfg = DECISION_CONFIG[r.decision];

  return (
    <div
      className="rounded-[20px] border p-4"
      style={{ borderColor: `${ACCENT}28`, background: `${ACCENT}06` }}
    >
      {/* 标头 */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <CheckCircle2 size={14} style={{ color: ACCENT }} />
        <span className="text-[13px] font-semibold text-[#F5E9C9]">谈判评估结果</span>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px]"
          style={{ borderColor: `${ACCENT}30`, color: `${ACCENT}cc` }}
        >
          LOCAL · Harvard PON
        </span>
      </div>

      {/* 决策 + ZOPA 双列 */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        {/* 决策 */}
        <div
          className="rounded-[12px] border px-3 py-2.5"
          style={{ borderColor: cfg.border, background: cfg.bg }}
        >
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: `${cfg.color}88` }}>
            决策建议
          </div>
          <div className="mt-1 text-[28px] font-bold leading-none" style={{ color: cfg.color }}>
            {cfg.label}
          </div>
          <div className="mt-1.5 text-[11px]" style={{ color: `${cfg.color}aa` }}>
            {r.reason}
          </div>
        </div>

        {/* ZOPA */}
        <div
          className="rounded-[12px] border px-3 py-2.5"
          style={{
            borderColor: r.zopaExists == null ? '#ffffff14' : r.zopaExists ? '#3DD68C30' : '#E5604D30',
            background: r.zopaExists == null ? 'rgba(6,8,14,0.35)' : r.zopaExists ? '#3DD68C0d' : '#E5604D0d',
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ color: r.zopaExists ? '#3DD68C88' : '#9aa0ad88' }}
          >
            ZOPA
          </div>
          <div
            className="mt-1 text-[20px] font-bold leading-none"
            style={{ color: r.zopaExists == null ? '#5a6070' : r.zopaExists ? '#3DD68C' : '#E5604D' }}
          >
            {r.zopaExists == null ? '未知' : r.zopaExists ? '存在' : '不存在'}
          </div>
          {r.surplus != null && (
            <div className="mt-1.5 text-[11px] text-[#8a9aaa]">
              剩余谈判空间：{r.surplus >= 0 ? '+' : ''}{r.surplus}
            </div>
          )}
          {r.zopaExists == null && (
            <div className="mt-1.5 text-[10.5px] text-[#4a5060]">
              未提供对方保留价，ZOPA 无法计算
            </div>
          )}
        </div>
      </div>

      {/* needsSignoff 恒提示 */}
      <div
        className="mb-3 flex items-center gap-2 rounded-[10px] border px-3 py-2"
        style={{ borderColor: '#E5604D50', background: '#E5604D0e' }}
      >
        <Scale size={13} style={{ color: '#E5604D' }} className="shrink-0" />
        <span className="text-[11.5px] font-semibold" style={{ color: '#E5604D' }}>
          对外承诺须人工确认门 —— needsSignoff 恒为真（铁律 13.2.5）
        </span>
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

export function NegotiationTab() {
  const [ownReservation, setOwnReservation] = useState('');
  const [offer, setOffer] = useState('');
  const [counterpartReservation, setCounterpartReservation] = useState('');
  const [betterWhenHigher, setBetterWhenHigher] = useState(true);
  const [result, setResult] = useState<OfferDecision | null>(null);
  const [running, setRunning] = useState(false);

  const bdr = { borderColor: `${ACCENT}28` };

  function analyse() {
    const own = parseFloat(ownReservation);
    const off = parseFloat(offer);
    if (isNaN(own) || isNaN(off)) return;
    const counterpart =
      counterpartReservation.trim() ? parseFloat(counterpartReservation) : undefined;
    setRunning(true);
    setTimeout(() => {
      setResult(
        evaluateOffer({
          ownReservation: own,
          offer: off,
          counterpartReservation: counterpart,
          betterWhenHigher,
        }),
      );
      setRunning(false);
    }, 0);
  }

  const canAnalyse =
    ownReservation.trim() !== '' &&
    offer.trim() !== '' &&
    !isNaN(parseFloat(ownReservation)) &&
    !isNaN(parseFloat(offer));

  return (
    <div className="flex flex-col gap-3">
      {/* 输入区 */}
      <div
        className="rounded-[20px] border px-4 pt-4 pb-3"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Scale size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">
            对外承诺司 · 谈判评估
          </span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        {/* 卖方/买方切换 */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-[#6a7080]">角色：</span>
          <div className="flex gap-1">
            {[
              { label: '卖方（报价越高越好）', val: true },
              { label: '买方（报价越低越好）', val: false },
            ].map((opt) => (
              <button
                key={String(opt.val)}
                type="button"
                onClick={() => setBetterWhenHigher(opt.val)}
                className="rounded-[8px] border px-2.5 py-1 text-[11px] transition"
                style={{
                  borderColor: betterWhenHigher === opt.val ? `${ACCENT}60` : '#ffffff14',
                  background: betterWhenHigher === opt.val ? `${ACCENT}18` : 'transparent',
                  color: betterWhenHigher === opt.val ? ACCENT : '#5a6070',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 数字输入 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[10px] text-[#6a7080]">
              己方保留价（BATNA 推导）
            </label>
            <input
              type="number"
              value={ownReservation}
              onChange={(e) => setOwnReservation(e.target.value)}
              placeholder="例：80000"
              className={`${INPUT_CLS} mt-0.5`}
              style={bdr}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#6a7080]">
              对方报价 offer
            </label>
            <input
              type="number"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="例：75000"
              className={`${INPUT_CLS} mt-0.5`}
              style={bdr}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#6a7080]">
              对方保留价（可选·估计）
            </label>
            <input
              type="number"
              value={counterpartReservation}
              onChange={(e) => setCounterpartReservation(e.target.value)}
              placeholder="—（不填则 ZOPA 未知）"
              className={`${INPUT_CLS} mt-0.5`}
              style={bdr}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={analyse}
            disabled={!canAnalyse || running}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: running ? `${ACCENT}30` : ACCENT,
              color: running ? ACCENT : '#040A10',
            }}
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
            {running ? '分析中…' : '评估报价'}
          </button>

          <span className="ml-auto text-[10px] text-[#5f5a48]">
            LOCAL · Harvard PON · BATNA 人工裁量
          </span>
        </div>
      </div>

      {/* 结果区 */}
      {result && <NegotiationResultPanel r={result} />}

      {/* 空状态 */}
      {!result && !running && (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <Scale size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">
            填入己方保留价和对方报价，点「评估报价」
          </p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">
            accept / counter / walk · ZOPA · surplus（Harvard PON）
          </p>
        </div>
      )}
    </div>
  );
}
