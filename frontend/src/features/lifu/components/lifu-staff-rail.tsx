'use client';

/**
 * 礼部 · 左栏班底（薄包装 · 2026-06-29）
 *
 * 渲染逻辑已收束到 DeptStaffRail；本文件只注入礼部专属数据和文案。
 */
import {
  ACCENT,
  LIFU_OFFICE_ORDER,
  LIFU_ROSTER,
  type LifuOfficeId,
} from '@/features/lifu/lib/lifu-roster';
import { DeptStaffRail } from '@/features/departments/components/dept-staff-rail';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';

export function LifuStaffRail({
  department,
  selected,
  onSelect,
}: {
  department: SixDepartmentContent;
  selected?: LifuOfficeId | null;
  onSelect: (id: LifuOfficeId) => void;
}) {
  return (
    <DeptStaffRail
      roster={LIFU_ROSTER}
      order={LIFU_OFFICE_ORDER}
      accent={ACCENT}
      statColor="#d8b8e0"
      dutyColor="#c090d0"
      selectedId={selected ?? null}
      onSelect={onSelect as (id: string) => void}
      department={department}
      subtitle="您的对外增长官 · 8 司编制"
      label="增长编制"
      introLabel="礼部是什么"
      disclaimer="礼部只做本地咨询分析；真实对外承诺须人工确认（铁律13.2.3）。"
    />
  );
}
