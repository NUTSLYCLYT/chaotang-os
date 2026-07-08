'use client';

/**
 * 兵部 · 中卷轴 · 跨部御前裁决（deal-verdict-scroll）· 2026-07-01
 *
 * 面板护城河：渲染 synthesizeDealVerdict 输出——户部成本 + 兵部三档报价(御史) + 刑部合规 + 一句裁决。
 * 这是 CRM 永远没有的跨部合成视图。presentational（props 来自 deal-verdict，数据来自 Twenty opportunity）。
 * 守朝堂统一 UI：深色宫廷 + 帝金 + GlassPanel。
 */
import { GlassPanel } from '@/components/GlassPanel';
import type { DealVerdict, QuoteTier } from '@/features/bingbu/lib/deal-verdict';

const GOLD = 'linear-gradient(135deg,#F0C66A,#D4A84B)';
const VERDICT: Record<QuoteTier['verdict'], { color: string; label: string }> = {
  ok: { color: '#7FE3B0', label: '御史 ✓' },
  warn: { color: '#F5A524', label: '御史 ⚠' },
  flag: { color: '#F0808C', label: '御史 ✗' },
};
const COMPLIANCE: Record<DealVerdict['compliance']['verdict'], { color: string; label: string }> = {
  ok: { color: '#7FE3B0', label: '合规稳健' },
  warn: { color: '#F5A524', label: '合规提示' },
  flag: { color: '#F0808C', label: '刑部拦' },
};
const yuan = (n: number | null): string => (n == null ? '—' : `¥${Math.round(n).toLocaleString('zh-CN')}`);

export function DealVerdictScroll({ verdict }: { verdict: DealVerdict }) {
  const cmp = COMPLIANCE[verdict.compliance.verdict];
  return (
    <GlassPanel variant="gold" hudCorners className="p-6">
      {/* 头 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#8f835f]">兵部 · 跨部御前裁决</p>
          <h2 className="display-serif mt-1 text-[18px] text-[#F5E9C9]">{verdict.opportunityName}</h2>
          <p className="mt-0.5 text-[12px] text-[#b6ab8c]">{verdict.customer}</p>
        </div>
        <span className="rounded-md border border-[#C2922E]/40 px-3 py-1 text-[11px] text-[#E8C879]">
          底座 · 户部成本 {yuan(verdict.quotes.length ? verdict.writeBack.chaotang_cost as number : null)}
        </span>
      </div>

      <div className="my-4 h-px bg-[#241F33]" />

      {/* 兵部三档报价 */}
      <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#7A6A3E]">兵部三档报价 · 御史巡查</p>
      {verdict.quotes.length === 0 ? (
        <p className="text-[13px] leading-7 text-[#c6bb9d]">成本未核定，兵部不出报价——先补户部真成本（诚实不编）。</p>
      ) : (
        <div className="space-y-2">
          {verdict.quotes.map((q) => (
            <div key={q.tier} className="flex items-center justify-between rounded-md bg-white/[0.02] px-3 py-2">
              <span className="text-[13px] text-[#EFEAD8]">
                {q.tier}
                <span className="ml-2 text-[10px] text-[#6A7099]">毛利 {q.marginPct}%</span>
              </span>
              <span className="text-[17px] font-bold" style={{ background: GOLD, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {yuan(q.sell)}
              </span>
              <span className="text-[11px]" style={{ color: VERDICT[q.verdict].color }}>{VERDICT[q.verdict].label}</span>
            </div>
          ))}
        </div>
      )}

      {/* 刑部合规 */}
      <div className="mt-4">
        <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#7A6A3E]">刑部合规</p>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold" style={{ color: cmp.color }}>{cmp.label}</span>
          <span className="text-[11px] text-[#9AA0B2]">{verdict.compliance.messages[0] ?? '付款条款稳健。'}</span>
        </div>
      </div>

      {/* 一句裁决 · 帝金 */}
      <div className="mt-5 rounded-lg border-l-2 border-[#F0C66A] bg-[rgba(240,198,106,0.06)] px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#7A6A3E]">御前裁决</p>
        <p className="mt-1.5 text-[14px] leading-7 text-[#F0DFAE]">{verdict.recommendation}</p>
        <p className="mt-2 text-[8px] text-[#5a5340]">朝堂·跨部合成 · 户部成本 + 兵部报价 + 刑部合规 —— CRM 没有的一层</p>
      </div>
    </GlassPanel>
  );
}
