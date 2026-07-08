import type { ComponentType } from 'react';

import type {
  SixDepartmentCode,
  SixDepartmentContent,
} from '@/features/departments/lib/six-departments-content';
import { HubuWorkspace } from '@/features/hubu/components/hubu-workspace';
import { GongbuOfficePage } from '@/features/gongbu/components/gongbu-office-page';
import { XingbuOfficePage } from '@/features/xingbu/components/xingbu-office-page';
import { BingbuOfficePage } from '@/features/bingbu/components/bingbu-office-page';
import { LibuOfficePage } from '@/features/libu/components/libu-office-page';
import { LifuOfficePage } from '@/features/lifu/components/lifu-office-page';

export type DepartmentOfficeComponent = ComponentType<{ department: SixDepartmentContent }>;

/**
 * Department-specific office workbenches mounted on /departments/[code].
 *
 * 统一布局(原朝堂设计升级版):左右两栏 + 中间卷轴 + 底部对话栏(两 agent)+ 高效简洁。
 * - 户部(finance):HubuWorkspace(震撼门 + 丞相参谋 + 决策队列),读真 overview(turso)。
 * - 工部(gongbu):GongbuOfficePage(与户部同构三栏办公厅),读真 tasks + 后端 pack_rd 产线回执。
 * 2026-07 起六部办公厅全部注册;真数据深度各部不一(刑部为上架步1),深化各回各部 feature。
 */
export const DEPARTMENT_OFFICES: Partial<Record<SixDepartmentCode, DepartmentOfficeComponent>> = {
  finance: HubuWorkspace,   // 户部 · 全套(震撼门+丞相参谋+eval)
  gongbu: GongbuOfficePage, // 工部 · 全套(卷轴+PACK真回执+双脑收口)
  legal: XingbuOfficePage,  // 刑部 · 孤儿办公厅上架(步1);卷轴/收口/独有真回执待深
  ops: BingbuOfficePage,    // 兵部
  personnel: LibuOfficePage,// 吏部
  market: LifuOfficePage,   // 礼部
};

export function getDepartmentOffice(code: SixDepartmentCode): DepartmentOfficeComponent | undefined {
  return DEPARTMENT_OFFICES[code];
}
