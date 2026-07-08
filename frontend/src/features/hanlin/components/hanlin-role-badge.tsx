'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import { HANLIN_ROLE_LABEL, type HanlinRole } from '@/features/hanlin/lib/access';

export function HanlinRoleBadge({
  role,
  note,
}: {
  role: HanlinRole;
  note?: string;
}) {
  return (
    <GlassPanel tone="elevated" padding="sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-[#D7CCA9]">
          当前翰林院席位
          <span className="ml-2 rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/10 px-2.5 py-1 text-[11px] text-[#F0C66A]">
            {HANLIN_ROLE_LABEL[role]}
          </span>
        </div>
        {note ? <div className="text-[11px] text-[#AEB7D1]">{note}</div> : null}
      </div>
    </GlassPanel>
  );
}
