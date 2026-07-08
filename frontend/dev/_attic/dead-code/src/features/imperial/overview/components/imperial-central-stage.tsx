'use client';

import Link from 'next/link';
import { Crown, Sparkles, ScrollText } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { OfficialSeatRing } from './official-seat-ring';
import type { OfficialSeat } from '../lib/official-seats';

export interface ImperialCentralStageProps {
  officials: OfficialSeat[];
}

export function ImperialCentralStage({ officials }: ImperialCentralStageProps) {
  return (
    <GlassPanel variant="gold" tone="elevated" padding="lg" hudCorners className="overflow-hidden">
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.2fr_0.9fr] xl:items-start">
        <div className="space-y-4">
          <div className="section-eyebrow text-[#8e7a4b]">Digital Twin</div>
          <h2 className="section-title text-[20px]">数字分身先帮你压缩局势</h2>
          <p className="body-copy text-[13px] leading-7 text-[#C8BEA2]">
            今日优先级已经收束为少数几位头上有章的官员。分身只代拟和整理证据，你再召一位入上书房，别在大殿里被所有信息拖住。
          </p>
          <div className="rounded-2xl border border-[#F0C66A]/12 bg-[#F0C66A]/[0.04] p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#F0C66A]">
              <Sparkles size={12} />
              今日先问
            </div>
            <div className="display-serif mt-3 text-[22px] font-semibold text-[#F7EDD1]">
              先问急章，再问边界，最后才批执行。
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] leading-5 text-[#C8BEA2]">
              可做:压缩局势;必须请示:高风险准驳;绝不代替:皇帝本人最终决定。
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <div className="section-eyebrow text-[#8e7a4b]">Imperial Court Stage · 大殿主舞台</div>
            <h2 className="display-serif mt-3 text-[30px] font-semibold text-[#F7EDD1]">
              丞相居中，群臣分翼，先见主位，再召群臣。
            </h2>
          </div>
          <OfficialSeatRing officials={officials} />
        </div>

        <div className="space-y-4">
          <div className="section-eyebrow text-[#8e7a4b]">丞相批注</div>
          <div className="rounded-2xl border border-[#F0C66A]/12 bg-[#F0C66A]/[0.04] p-5">
            <div className="flex items-center gap-2 text-[#F0C66A]">
              <Crown size={14} />
              <span className="text-[12px] font-medium">丞相今日批注</span>
            </div>
            <p className="body-copy mt-3 text-[13px] leading-7 text-[#D5C8A8]">
              大殿只看最该先处理的一件事。若急章在闪，就先召官员入上书房；若分歧已成，就直接送军机处或丞相台收束。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/command-center"
                className="rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/12 px-4 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
              >
                去丞相台
              </Link>
              <Link
                href="/grand-council"
                className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5"
              >
                去军机处
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[#6BA0FF]">
              <ScrollText size={14} />
              <span className="text-[12px] font-medium">朝会规则</span>
            </div>
            <ul className="mt-3 space-y-2 text-[12px] leading-6 text-[#B8C0DA]">
              <li>1. 大殿先定今日唯一焦点。</li>
              <li>2. 上书房处理单官员 dossier 与奏章。</li>
              <li>3. 军机处处理多方会签与争议。</li>
            </ul>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
