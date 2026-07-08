'use client';

/**
 * 吏部 · 左栏司编制（薄包装 · 2026-06-29）
 *
 * 渲染逻辑已收束到 DeptStaffRail；本文件只注入吏部专属数据和文案。
 */
import {
  ACCENT,
  LIBU_OFFICE_ORDER,
  LIBU_ROSTER,
  type LibuOfficeId,
} from '@/features/libu/lib/libu-roster';
import { DeptStaffRail } from '@/features/departments/components/dept-staff-rail';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';

export function LibuStaffRail({
  department,
  selected,
  onSelect,
}: {
  department: SixDepartmentContent;
  selected?: LibuOfficeId | null;
  onSelect: (id: LibuOfficeId) => void;
}) {
  return (
    <DeptStaffRail
      roster={LIBU_ROSTER}
      order={LIBU_OFFICE_ORDER}
      accent={ACCENT}
      statColor="#c8c0f8"
      dutyColor="#b0a8e8"
      selectedId={selected ?? null}
      onSelect={onSelect as (id: string) => void}
      department={department}
      subtitle="人事决策官 · 6 司编制"
      label="人事编制"
      introLabel="吏部是什么"
      disclaimer="吏部只做本地咨询分析；高风险人事决策（辞退/降薪）须人工确认（铁律13.2.3）。"
    />
  );
}
