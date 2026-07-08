'use client';

/**
 * 户部 · 工作区（M2）三栏 + 司选择状态。
 * 点左栏某司 → 中栏卷轴切到该司圣旨详情；返回回到全部待拍板。
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import { HubuActivityRail } from '@/features/hubu/components/hubu-activity-rail';
import { HubuDecisionCockpit } from '@/features/hubu/components/hubu-decision-cockpit';
import { HubuEdictHero } from '@/features/hubu/components/hubu-edict-hero';
import { HubuStaffDetail } from '@/features/hubu/components/hubu-staff-detail';
import { HubuStaffRail } from '@/features/hubu/components/hubu-staff-rail';
import { QintianSignalWatchCard } from '@/features/qintian/components/signal-watch-card';

export function HubuWorkspace({ department }: { department: SixDepartmentContent }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:overflow-hidden">
      <HubuStaffRail
        department={department}
        selected={selected}
        onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
      />

      <main
        className="order-first min-h-[60vh] rounded-[24px] border px-4 py-4 xl:order-none xl:min-h-0 xl:overflow-y-auto"
        style={{ borderColor: '#F0C66A1c', background: 'rgba(6,8,14,0.55)' }}
      >
        {selected ? (
          <div className="flex h-full min-h-0 flex-col">
            <button
              onClick={() => setSelected(null)}
              className="mb-2 inline-flex w-fit items-center gap-1.5 text-[12px] text-[#b6ab8c] transition hover:text-[#F5E9C9]"
            >
              <ArrowLeft size={14} /> 返回全部待拍板
            </button>
            <div className="min-h-0 flex-1">
              <HubuStaffDetail staffId={selected} />
            </div>
          </div>
        ) : (
          <>
            <QintianSignalWatchCard relevanceHint="采购成本 / 预算裁决" />
            <HubuEdictHero />
            <HubuDecisionCockpit />
          </>
        )}
      </main>

      <HubuActivityRail />
    </div>
  );
}
