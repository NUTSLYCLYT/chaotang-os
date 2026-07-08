'use client';

/**
 * 刑部 · 左栏班底（薄包装 · 2026-06-29）
 *
 * 渲染逻辑已收束到 DeptStaffRail；本文件只注入刑部专属数据和文案。
 */
import {
  ACCENT,
  XINGBU_OFFICE_ORDER,
  XINGBU_ROSTER,
  type XingbuOfficeId,
} from '@/features/xingbu/lib/xingbu-roster';
import { DeptStaffRail } from '@/features/departments/components/dept-staff-rail';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';

export function XingbuStaffRail({
  department,
  selected,
  onSelect,
}: {
  department: SixDepartmentContent;
  selected?: XingbuOfficeId | null;
  onSelect: (id: XingbuOfficeId) => void;
}) {
  return (
    <DeptStaffRail
      roster={XINGBU_ROSTER}
      order={XINGBU_OFFICE_ORDER}
      accent={ACCENT}
      statColor="#bfe6cf"
      dutyColor="#7aaa7a"
      selectedId={selected ?? null}
      onSelect={onSelect as (id: string) => void}
      department={department}
      subtitle="您的法务风控 · 8 司 AI 法务专员"
      label="法务编制"
      introLabel="刑部是什么"
      disclaimer="刑部只读 + 追问 + 合同初审；真实法律决策须人工/法务终审（铁律9）。"
    />
  );
}
