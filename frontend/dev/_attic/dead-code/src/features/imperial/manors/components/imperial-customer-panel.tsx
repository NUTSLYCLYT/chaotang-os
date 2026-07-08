'use client';

import { BadgeDollarSign, Globe2, Network } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ManorRoomLayout } from './manor-room-layout';

const CUSTOMERS = [
  { name: '北美核心客户', x: '22%', y: '30%', tone: '#F0C66A', detail: '高价值 · 待会谈' },
  { name: '欧洲渠道伙伴', x: '48%', y: '24%', tone: '#6BA0FF', detail: '中价值 · 待口径统一' },
  { name: '东南亚新客群', x: '70%', y: '58%', tone: '#3DD68C', detail: '增长机会 · 待跟进' },
  { name: '中东战略账户', x: '42%', y: '62%', tone: '#F43F5E', detail: '高风险 · 待合规判断' },
] as const;

export function ImperialCustomerPanel() {
  return (
    <ManorRoomLayout
      eyebrow="Diplomacy Hall · 外交部客户分布厅"
      title="客户地理分布与交互热度"
      summary="这不是 CRM 列表，而是一张客户关系版图。先看区域、热度、价值，再决定召谁会谈、谁先统一口径、谁需要丞相先行压判断。"
      leftRail={
        <>
          <GlassPanel padding="md">
            <div className="flex items-center gap-2 text-[#F0C66A]">
              <Globe2 size={14} />
              <Network size={14} />
              <BadgeDollarSign size={14} />
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">Room Brief</div>
            <div className="mt-2 space-y-3 text-[12px] leading-6 text-[#C9D0E3]">
              <div>当前优先：北美核心客户与中东战略账户。</div>
              <div>先统一会谈口径，再决定是否进入上书房形成正式客户奏章。</div>
            </div>
          </GlassPanel>
          <GlassPanel padding="md">
            <div className="section-eyebrow">Meeting Queue</div>
            <div className="mt-3 space-y-3">
              {['北美核心客户 · CEO 层沟通', '欧洲渠道伙伴 · 联合口径会前确认', '中东战略账户 · 合规边界复核'].map((item) => (
                <div key={item} className="rounded-xl border border-white/6 bg-white/[0.03] p-3 text-[12px] leading-6 text-[#C9D0E3]">
                  {item}
                </div>
              ))}
            </div>
          </GlassPanel>
        </>
      }
      main={
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-[340px] overflow-hidden rounded-[28px] border border-[#F0C66A]/12 bg-[#060913]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_42%,rgba(240,198,106,0.07),transparent_40%),linear-gradient(180deg,#09101b_0%,#060913_100%)]" />
            <div className="absolute inset-[12%] rounded-[48%] border border-[#F0C66A]/8" />
            <div className="absolute inset-[20%] rounded-[48%] border border-[#6BA0FF]/8" />
            {CUSTOMERS.map((customer) => (
              <div key={customer.name} className="absolute" style={{ left: customer.x, top: customer.y }}>
                <div className="relative -translate-x-1/2 -translate-y-1/2">
                  <span
                    className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
                    style={{ background: `${customer.tone}22` }}
                  />
                  <span
                    className="block h-3.5 w-3.5 rounded-full border border-black/30"
                    style={{ background: customer.tone, boxShadow: `0 0 14px ${customer.tone}` }}
                  />
                  <div className="mt-3 whitespace-nowrap rounded-full border border-white/8 bg-black/35 px-2 py-1 text-[11px] text-[#E7DDBF]">
                    {customer.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {CUSTOMERS.map((customer) => (
              <div key={customer.name} className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-[#F5E9C9]">{customer.name}</div>
                  <span
                    className="rounded-full px-2 py-1 text-[11px]"
                    style={{
                      color: customer.tone,
                      border: `1px solid ${customer.tone}33`,
                      background: `${customer.tone}12`,
                    }}
                  >
                    {customer.detail}
                  </span>
                </div>
                <div className="body-copy mt-2 text-[12px] leading-6 text-[#B8C0DA]">
                  建议先统一会谈口径，再决定是否进入上书房形成正式客户奏章。
                </div>
              </div>
            ))}
          </div>
          </div>
          <GlassPanel padding="md">
            <div className="section-eyebrow">Negotiation Protocol</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {['先统一口径', '再定会谈层级', '最后形成客户奏章'].map((item) => (
                <div key={item} className="rounded-xl border border-white/6 bg-white/[0.03] p-3 text-[12px] leading-6 text-[#C9D0E3]">
                  {item}
                </div>
              ))}
            </div>
          </GlassPanel>
          <GlassPanel padding="md">
            <div className="section-eyebrow">Relationship Matrix</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                ['主战区', '北美核心客户与中东战略账户'],
                ['当前纪律', '统一口径先于任何高层会谈'],
                ['升级条件', '当关系问题触及品牌与合规边界时，送军机处会签'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl border border-white/6 bg-white/[0.03] p-3">
                  <div className="text-[11px] font-semibold text-[#F5E9C9]">{title}</div>
                  <div className="mt-1 text-[12px] leading-6 text-[#C9D0E3]">{body}</div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      }
      rightRail={
        <>
          <GlassPanel padding="md">
            <div className="section-eyebrow">Strategy Note</div>
            <div className="mt-2 text-[12px] leading-6 text-[#D9CFB4]">
              外交部不直接给销售动作，而是先给关系判断：谁值得面陈，谁需要礼部先收口径，谁必须丞相先看。
            </div>
          </GlassPanel>
          <GlassPanel padding="md">
            <div className="section-eyebrow">Current Signals</div>
            <div className="mt-3 space-y-2">
              {['高价值账户 2', '待统一口径 1', '高风险关系 1'].map((item) => (
                <div key={item} className="rounded-xl border border-white/6 bg-black/15 px-3 py-2 text-[11px] text-[#9AA3C4]">
                  {item}
                </div>
              ))}
            </div>
          </GlassPanel>
        </>
      }
    />
  );
}
