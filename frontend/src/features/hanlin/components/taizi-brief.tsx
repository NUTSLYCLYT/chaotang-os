'use client';

import { Crown, ScrollText, Sparkles, Waypoints } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

interface TaiziBriefProps {
  awardCycle: string;
  submittedContributions: number | string;
  activeCandidates: number | string;
  incubatingModules: number | string;
  exportableModules: number | string;
}

export function TaiziBrief({
  awardCycle,
  submittedContributions,
  activeCandidates,
  incubatingModules,
  exportableModules,
}: TaiziBriefProps) {
  return (
    <GlassPanel tone="elevated" padding="lg" className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[760px]">
          <div className="page-eyebrow">Jixiaolan · 纪晓岚简报</div>
          <h2 className="mt-3 text-[24px] font-semibold leading-tight text-[#F5E9C9] md:text-[30px]">
            纪晓岚统翰林院，既管本期开榜，也管系统下一次跃迁。
          </h2>
          <p className="mt-3 max-w-[700px] text-[13px] leading-7 text-[#BFC7DA]">
            这不是普通榜单页。纪晓岚负责持续搜策 GitHub 与其他 hub 的前沿能力，主持中状元榜，
            决定哪些能力值得吸收进 CourtOS，哪些内部模块值得修典并对外出售。
          </p>
        </div>
        <div className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#F0C66A]">
          当前榜期 · {awardCycle}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BriefStat icon={ScrollText} label="本期投稿" value={`${submittedContributions}`} />
        <BriefStat icon={Sparkles} label="升级候选" value={`${activeCandidates}`} />
        <BriefStat icon={Waypoints} label="修典中模块" value={`${incubatingModules}`} />
        <BriefStat icon={Crown} label="可出海模块" value={`${exportableModules}`} />
      </div>
    </GlassPanel>
  );
}

function BriefStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Crown;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">
        <Icon size={12} className="text-[#F0C66A]" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-[24px] font-semibold text-[#F5E9C9]">{value}</div>
    </div>
  );
}
