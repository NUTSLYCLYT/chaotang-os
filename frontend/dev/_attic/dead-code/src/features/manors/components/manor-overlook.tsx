'use client';

/**
 * 十庄园俯瞰 · Manor Overlook
 *
 * 一屏内呈现全部 10 座庄园，每座一张卡，卡内嵌蜂巢九宫（3×3）
 * 表示 7 专家 + 红队 + 蓝队。点击进 /manors/[domain] 延伸。
 *
 * 沿用原版视觉（rounded-2xl / border-white/8 / bg-white/[0.03]），
 * 不另立一套 design tokens。
 */

import Link from 'next/link';
import { MANOR_EXECUTIONS } from '@/features/shared/lib/court-flow-data';

interface ManorDef {
  domain: string;
  nameCn: string;
  nameEn: string;
  emoji: string;
  price: string;
  brief: string;
}

const MANORS: ManorDef[] = [
  { domain: 'legal', nameCn: '律师庄', nameEn: 'Legal', emoji: '⚖️', price: '19.9', brief: '刑民商 · 七位讼师 + 红蓝对抗' },
  { domain: 'hr', nameCn: 'HR 庄', nameEn: 'Human', emoji: '👥', price: '14.9', brief: '组织 · 招聘 · 劳动法 · 绩效' },
  { domain: 'finance', nameCn: '财务庄', nameEn: 'Finance', emoji: '💰', price: '24.9', brief: '账本 · 预算 · 投融 · 税务' },
  { domain: 'ecommerce', nameCn: '电商庄', nameEn: 'E-com', emoji: '🛒', price: '9.9', brief: '跨境 · 渠道 · 经营现金流' },
  { domain: 'ops', nameCn: '运维庄', nameEn: 'Ops', emoji: '🛠', price: '29.9', brief: 'SRE · 平台 · 变更 · 审计' },
  { domain: 'compliance', nameCn: '合规庄', nameEn: 'Compliance', emoji: '🛡', price: '29.9', brief: '数据治理 · 隐私 · 第三方' },
  { domain: 'sales', nameCn: '销售庄', nameEn: 'Sales', emoji: '📞', price: '12.9', brief: '线索 · 培育 · 成交 · 回款' },
  { domain: 'marketing', nameCn: '营销庄', nameEn: 'Marketing', emoji: '📣', price: '15.9', brief: '渠道 · SEO · 落地页 · 实验' },
  { domain: 'packaging', nameCn: '包装庄', nameEn: 'Packaging', emoji: '📦', price: '16.9', brief: '结构 · 材料 · 印制 · 解包体验' },
  { domain: 'supply-chain', nameCn: '供应链', nameEn: 'Supply', emoji: '🚚', price: '22.9', brief: '采购 · 仓储 · 风控 · 韧性' },
];

export function ManorOverlook() {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">Ten Manors · 十庄园俯瞰</div>
          <h2 className="display-serif mt-1 text-[20px] font-semibold text-[#F5E9C9]">
            全图 · 每座庄园 7 专家 + 红蓝对抗
          </h2>
        </div>
        <div className="text-[10px] text-[#6A7299]">点击进入任一庄园看蜂群动静</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {MANORS.map((m) => (
          <ManorCard key={m.domain} manor={m} />
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Single manor card
   ========================================================================== */

function ManorCard({ manor }: { manor: ManorDef }) {
  const exec = MANOR_EXECUTIONS.find((e) => e.domain === manor.domain);
  const activeWorkbench = exec?.workbench?.filter(
    (w) => w.state === 'running' || w.state === 'summarizing',
  ) ?? [];
  const activeCount = activeWorkbench.length;
  const blockers = exec?.actionBoard?.blockers?.length ?? 0;

  const dotColor = blockers > 0 ? '#F97316' : activeCount > 0 ? '#3DD68C' : exec ? '#F0C66A' : '#3F466A';
  const status = blockers > 0 ? `阻 ${blockers}` : activeCount > 0 ? `办 ${activeCount}` : exec ? '待命' : '闲';
  const latest = exec?.workbench?.[0];
  const briefText = latest
    ? `${latest.owner} · ${latest.detail}`
    : manor.brief;

  return (
    <Link
      href="/manors"
      className="group flex h-full flex-col rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#F0C66A]/30 hover:bg-white/[0.05]"
    >
      {/* Top · emoji + 名 + 价 + status dot */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #F0C66A, #8A6A2A)',
            boxShadow: activeCount > 0
              ? '0 0 16px rgba(240,198,106,0.45), inset 0 0 0 1px rgba(240,198,106,0.6)'
              : '0 0 6px rgba(240,198,106,0.18), inset 0 0 0 1px rgba(240,198,106,0.35)',
          }}
        >
          <span className="text-[18px]">{manor.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="display-serif text-[14px] font-semibold text-[#F5E9C9]">
            {manor.nameCn}
          </div>
          <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-[#6A7299]">
            {manor.nameEn}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-[#8F835F]">¥{manor.price}</span>
          <span className="mt-1 flex items-center gap-1 text-[9px]" style={{ color: dotColor }}>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: dotColor, boxShadow: `0 0 4px ${dotColor}` }}
            />
            {status}
          </span>
        </div>
      </div>

      {/* Swarm 9 hex */}
      <div className="mt-3">
        <SwarmHex activeSlots={activeCount} totalSlots={9} hasBlocker={blockers > 0} />
      </div>

      {/* Brief · one line */}
      <div className="mt-3 flex-1 rounded-xl border border-white/6 bg-black/15 px-3 py-2">
        <div className="line-clamp-2 text-[11px] leading-5 text-[#C8CDD8]">
          {briefText}
        </div>
      </div>

      {/* Footer · 7 expert + 2 对抗 */}
      <div className="mt-2 flex items-center justify-between text-[9px] text-[#6A7299]">
        <span>7 专家 + 红蓝</span>
        <span className="group-hover:text-[#F0C66A] transition-colors">{exec ? "入庄园 →" : "待接入"}</span>
      </div>
    </Link>
  );
}

/* ==========================================================================
   SwarmHex · 3×3 蜂巢九宫
   ========================================================================== */

function SwarmHex({
  activeSlots,
  totalSlots,
  hasBlocker,
}: {
  activeSlots: number;
  totalSlots: number;
  hasBlocker: boolean;
}) {
  // Layout: 前 7 = expert, 第 8 = red, 第 9 = blue
  const cells = Array.from({ length: totalSlots }, (_, i) => {
    const role: 'expert' | 'red' | 'blue' =
      i < 7 ? 'expert' : i === 7 ? 'red' : 'blue';
    const active = i < activeSlots;
    return { i, role, active };
  });

  const roleColor = {
    expert: '#F0C66A',
    red: '#EF4444',
    blue: '#6BA0FF',
  } as const;

  return (
    <div className="grid grid-cols-3 gap-1">
      {cells.map((c) => {
        const base = roleColor[c.role];
        const bg = c.active
          ? base
          : `${base}24`;
        const glow = c.active
          ? `0 0 6px ${base}99, inset 0 0 0 1px ${base}`
          : `inset 0 0 0 1px ${base}40`;
        return (
          <div
            key={c.i}
            className="flex h-4 items-center justify-center rounded-sm"
            style={{
              background: bg,
              boxShadow: glow,
              opacity: hasBlocker && c.role === 'expert' && !c.active ? 0.5 : 1,
            }}
            aria-label={c.role === 'red' ? '红队' : c.role === 'blue' ? '蓝队' : '专家'}
          />
        );
      })}
    </div>
  );
}
