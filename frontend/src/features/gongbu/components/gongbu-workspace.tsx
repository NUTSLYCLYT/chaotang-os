'use client';

/** 工部 · 工作区（M2）三栏 + 司选择：点司→圣旨详情/返回。 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import { GongbuActivityRail } from '@/features/gongbu/components/gongbu-activity-rail';
import { GongbuDecisionCockpit } from '@/features/gongbu/components/gongbu-decision-cockpit';
import { GongbuEdictHero } from '@/features/gongbu/components/gongbu-edict-hero';
import { GongbuFeasibilitySwarmPanel } from '@/features/gongbu/components/gongbu-feasibility-swarm-panel';
import { GongbuPackSizingPanel } from '@/features/gongbu/components/gongbu-pack-sizing-panel';
import { GongbuStaffDetail } from '@/features/gongbu/components/gongbu-staff-detail';
import { GongbuStaffRail } from '@/features/gongbu/components/gongbu-staff-rail';
import { QintianSignalWatchCard } from '@/features/qintian/components/signal-watch-card';

export function GongbuWorkspace({ department }: { department: SixDepartmentContent }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:overflow-hidden">
      <GongbuStaffRail department={department} selected={selected} onSelect={(id) => setSelected((cur) => (cur === id ? null : id))} />
      <main className="order-first min-h-[60vh] rounded-[24px] border px-4 py-4 xl:order-none xl:min-h-0 xl:overflow-y-auto" style={{ borderColor: '#7FC9A81c', background: 'rgba(6,8,14,0.55)' }}>
        {selected ? (
          <div className="flex h-full min-h-0 flex-col">
            <button onClick={() => setSelected(null)} className="mb-2 inline-flex w-fit items-center gap-1.5 text-[12px] text-[#8fa39a] transition hover:text-[#EAF3EE]">
              <ArrowLeft size={14} /> 返回全部待裁
            </button>
            <div className="min-h-0 flex-1"><GongbuStaffDetail staffId={selected} /></div>
          </div>
        ) : (
          <>
            <QintianSignalWatchCard relevanceHint="交付排期 / 物料备货" />
            <GongbuEdictHero />
            <GongbuPackSizingPanel />
            <GongbuFeasibilitySwarmPanel />
            <GongbuDecisionCockpit />
          </>
        )}
      </main>
      <GongbuActivityRail />
    </div>
  );
}
