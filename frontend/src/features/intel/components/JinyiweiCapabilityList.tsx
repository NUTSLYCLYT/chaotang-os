import { CheckCircle2, CircleAlert, Wrench } from 'lucide-react';

import type { JinyiweiBriefPhase, JinyiweiSourceLabel } from '../lib/jinyiwei-brief-contract';

type CapabilityState = '已接通' | '当前不可用' | '需要配置';

function Capability({ title, detail, state }: { title: string; detail: string; state: CapabilityState }) {
  const tone = state === '已接通' ? '#3DD68C' : state === '当前不可用' ? '#F43F5E' : '#F5A524';
  const Icon = state === '已接通' ? CheckCircle2 : state === '当前不可用' ? CircleAlert : Wrench;
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#D9DDEB]">
          <Icon size={11} style={{ color: tone }} />
          {title}
        </div>
        <span className="shrink-0 font-mono text-[8px]" style={{ color: tone }}>{state}</span>
      </div>
      <div className="mt-1 text-[9px] leading-4 text-[#747D9B]">{detail}</div>
    </div>
  );
}

export function JinyiweiCapabilityList({
  phase,
  latestLabel,
}: {
  phase: JinyiweiBriefPhase;
  latestLabel: JinyiweiSourceLabel | null;
}) {
  const endpointState: CapabilityState = phase === 'error' ? '当前不可用' : '已接通';
  const searchState: CapabilityState = latestLabel === 'LIVE_SEARCH'
    ? '已接通'
    : phase === 'error'
      ? '当前不可用'
      : '需要配置';
  return (
    <section data-testid="jinyiwei-capabilities">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#8F835F]">
        <CheckCircle2 size={12} className="text-[#E0553A]" />
        后端实装能力
        <span className="h-px flex-1 bg-gradient-to-r from-[#E0553A]/18 to-transparent" />
      </div>
      <div className="mt-2 space-y-1.5">
        <Capability title="谍报端点" detail="POST /api/intel/brief" state={endpointState} />
        <Capability title="联网采证" detail="Tavily 或调用方证据链" state={searchState} />
        <Capability title="确定性核验" detail="一手 / 多源 / 单源 / 未证实" state="已接通" />
        <Capability title="可信度裁决" detail="入库 / 待核 / 拒" state="已接通" />
        <Capability title="归档存证" detail="核验结果写入真值台账" state="已接通" />
      </div>
    </section>
  );
}
