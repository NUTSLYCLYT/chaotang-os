/**
 * 六部大厅 vitrine · 真/骨架派生（纯函数 · 2026-06-27）
 *
 * 「真」部门 = 已注册升级版决策办公厅(户/兵/工)。唯一真相 = 办公厅注册表
 * `getDepartmentOffice`（铁律2 SSOT），本模块只做「庄园卡 key → 部门码 → 是否真」的纯映射。
 *
 * 铁律4 不变量：真徽(金光/LIVE) ⟺ 真注册了办公厅。严禁硬编码"哪些部门是真"的平行清单——
 * 否则某天有人手滑把没做完的部门点亮金光，就把老板/客户骗了。回归断言钉死此等式。
 */
import { getDepartmentOffice } from '@/features/departments/lib/department-offices';
import { isSixDepartmentCode } from '@/features/departments/lib/six-departments-content';
import { CHAOTANG_V1_LIUBU } from '@/config/chaotang-v1-modules';

/** 庄园六部卡 key → 六部部门码。 */
export const MINISTRY_TO_DEPT_CODE: Record<string, string> = {
  libu: 'personnel',
  hubu: 'finance',
  libu2: 'market',
  bingbu: 'ops',
  xingbu: 'legal',
  gongbu: 'gongbu',
};

/** 该庄园卡对应的部门是否「真」（注册了升级版办公厅）。 */
export function isMinistryLive(ministryKey: string): boolean {
  const code = MINISTRY_TO_DEPT_CODE[ministryKey];
  const v1Department = CHAOTANG_V1_LIUBU.find((department) => department.canonicalCode === code);
  return v1Department?.status === 'active' && !!code && isSixDepartmentCode(code) && !!getDepartmentOffice(code);
}
