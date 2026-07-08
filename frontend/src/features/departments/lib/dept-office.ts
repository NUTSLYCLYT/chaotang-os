/**
 * 部门司编制 · 共享类型 + 纯函数（2026-06-29）
 *
 * 刑部/礼部/吏部三个 roster 的 role 形状完全一致；
 * 统一从这里 import DeptOfficeRole，各自 roster 仍是数据 SSOT。
 */

/** 通用司编制角色（各部 roster 对齐此形状）。 */
export interface DeptOfficeRole {
  id: string;
  name: string;
  role: string;
  duty: string;
  /** 能力/skill 配置（运行态本命方法+数据源）。 */
  skill: string;
  /** 复用的已建件（为空=待建）。 */
  reuses: string[];
  /** 是否已接真引擎（诚实：false=骨架待建）。 */
  engine: boolean;
}

/** 通用引擎统计：已接真引擎数 / 总司数。 */
export function deptEngineStats(roster: Record<string, DeptOfficeRole>): { real: number; total: number } {
  const all = Object.values(roster);
  return { real: all.filter((o) => o.engine).length, total: all.length };
}
