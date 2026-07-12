'use client';

import { useState, type ReactElement } from 'react';
import { GlassPanel } from '@/features/shangshufang/components/atoms';
import { DeptDigestBar } from '@/features/shared/components/dept-digest-bar';
import { ACCENT, LIFU_OFFICE_ORDER, LIFU_ROSTER, type LifuOfficeId } from '@/features/lifu/lib/lifu-roster';
import { RelationshipLedgerTab } from './relationship-ledger-tab';
import { TrafficGrowthTab } from './traffic-growth-tab';
import { CommitmentGateTab } from './commitment-gate-tab';
import { PrCrisisTab } from './pr-crisis-tab';

/** 有真交互 tab 的司(其余 4 司仍是骨架,诚实展示"待通电",不冒充)。 */
const WIRED_OFFICES: LifuOfficeId[] = ['relationship_ledger', 'traffic_growth', 'commitment_gate', 'pr_crisis'];

const TAB_BODY: Partial<Record<LifuOfficeId, () => ReactElement>> = {
  relationship_ledger: RelationshipLedgerTab,
  traffic_growth: TrafficGrowthTab,
  commitment_gate: CommitmentGateTab,
  pr_crisis: PrCrisisTab,
};

export function LifuOfficeDesk() {
  const [active, setActive] = useState<LifuOfficeId>('relationship_ledger');
  const ActiveBody = TAB_BODY[active];

  const digestOffices = LIFU_OFFICE_ORDER.map((id) => {
    const o = LIFU_ROSTER[id];
    return { name: o.name, role: o.role, engine: o.engine, isChief: id === 'chief' };
  });

  return (
    <div className="space-y-3">
      <DeptDigestBar deptName="礼部" offices={digestOffices} accent={ACCENT} />

      <GlassPanel accent={ACCENT} className="p-4">
        <div className="flex flex-wrap gap-1.5 border-b border-white/8 pb-3">
          {WIRED_OFFICES.map((id) => {
            const office = LIFU_ROSTER[id];
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                className="rounded-[8px] px-3 py-1.5 text-[11.5px] font-semibold transition"
                style={{
                  color: isActive ? '#0b0d16' : ACCENT,
                  background: isActive ? ACCENT : `${ACCENT}14`,
                  border: `1px solid ${ACCENT}${isActive ? 'ff' : '35'}`,
                }}
              >
                {office.name}
              </button>
            );
          })}
        </div>
        <div className="pt-4">{ActiveBody ? <ActiveBody /> : null}</div>
      </GlassPanel>
    </div>
  );
}
