'use client';

import { Globe, Package, Radar, ShipWheel } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ManorRoomLayout } from './manor-room-layout';

const CHANNELS = [
  { label: '北美站', value: 74, tone: '#F0C66A' },
  { label: '欧洲站', value: 58, tone: '#6BA0FF' },
  { label: '东南亚站', value: 81, tone: '#3DD68C' },
  { label: '中东站', value: 36, tone: '#F43F5E' },
] as const;

export function ImperialOverseasPanel() {
  return (
    <ManorRoomLayout
      eyebrow="Overseas Hall · 远洋部跨境经营厅"
      title="跨境渠道与经营动作主视区"
      summary="先看渠道、地区、现金流和试验状态，再决定是否扩大样本、收缩投放，或回到军机处继续收束经营边界。"
      leftRail={
        <>
          <GlassPanel padding="md">
            <div className="flex items-center gap-2 text-[#F0C66A]">
              <ShipWheel size={14} />
              <Globe size={14} />
              <Radar size={14} />
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">Operating Rule</div>
            <div className="mt-2 text-[12px] leading-6 text-[#D9CFB4]">
              远洋部不追求同时铺开所有区域，而是先看回款、物流、样本纪律，再决定是否扩张。
            </div>
          </GlassPanel>
          <GlassPanel padding="md">
            <div className="section-eyebrow">Current Commands</div>
            <div className="mt-3 space-y-3">
              {['保留东南亚试跑样本', '北美站先看回款，不加码', '中东站先审合规再动'].map((item) => (
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
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] border border-white/6 bg-[#060913] p-4">
            <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">Cross-border Channels</div>
            <div className="space-y-3">
              {CHANNELS.map((channel) => (
                <div key={channel.label}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-[#D9CFB4]">{channel.label}</span>
                    <span className="font-mono" style={{ color: channel.tone }}>{channel.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${channel.value}%`,
                        background: `linear-gradient(90deg, ${channel.tone}99, ${channel.tone})`,
                        boxShadow: `0 0 14px ${channel.tone}55`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#F0C66A]/12 bg-[#F0C66A]/[0.04] p-4 text-[12px] leading-6 text-[#D9CFB4]">
              当前建议：继续保留东南亚小样本试跑，北美站优先看回款，欧洲站先统一口径，中东站优先审合规。
            </div>
          </div>
          <div className="rounded-[28px] border border-white/6 bg-[#060913] p-4">
            <div className="mb-3 flex items-center gap-2 text-[#F0C66A]">
              <Package size={14} />
              <span className="text-[11px] uppercase tracking-[0.18em]">Operating Notes</span>
            </div>
            <div className="space-y-3">
              {[
                '渠道样本：维持受控试验，不做一次性放量。',
                '物流链路：优先压缩异常履约时间。',
                '现金流纪律：先看回款，再增预算。',
                '品牌口径：出海表达由礼部统一收口。',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-[12px] leading-6 text-[#C9D0E3]">
                  {item}
                </div>
              ))}
            </div>
          </div>
          </div>
          <GlassPanel padding="md">
            <div className="section-eyebrow">Route Risk Matrix</div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {['北美：回款优先', '欧洲：口径优先', '东南亚：样本扩张', '中东：合规压舱'].map((item) => (
                <div key={item} className="rounded-xl border border-white/6 bg-white/[0.03] p-3 text-[12px] leading-6 text-[#C9D0E3]">
                  {item}
                </div>
              ))}
            </div>
          </GlassPanel>
          <GlassPanel padding="md">
            <div className="section-eyebrow">Operating Matrix</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                ['主战区', '东南亚样本、北美回款、中东合规'],
                ['当前纪律', '现金流、物流、口径三线同时可控'],
                ['升级条件', '当履约与品牌口径冲突时，直接送军机处'],
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
            <div className="section-eyebrow">Execution Summary</div>
            <div className="mt-3 space-y-2">
              {['渠道健康 3/4', '物流高压 1', '可扩样本 1'].map((item) => (
                <div key={item} className="rounded-xl border border-white/6 bg-black/15 px-3 py-2 text-[11px] text-[#9AA3C4]">
                  {item}
                </div>
              ))}
            </div>
          </GlassPanel>
          <GlassPanel padding="md">
            <div className="section-eyebrow">Council Advice</div>
            <div className="mt-2 text-[12px] leading-6 text-[#D9CFB4]">
              远洋部当前最重要的不是继续开渠道，而是让现金流、物流、口径三条线同时保持可控。
            </div>
          </GlassPanel>
        </>
      }
    />
  );
}
