/**
 * 今日朝报 · 每日朝会自转产出契约
 *
 * 后端 GET :8081/api/court-session/latest 的 data 形状。
 * 产出链路：八部蜂群 grounded 在真实公司数据上上奏 → 御史核真库标 ✅有据/⚠️无据 →
 *           军机处暴露跨部门矛盾 → 数字带 [一手]/[待核] 可信度章。
 *
 * Source of Truth — 不可随意增删字段。
 */

export interface CourtSessionSummary {
  /** 上奏部数 */
  deptCount: number;
  /** ✅ 有据 */
  groundedCount: number;
  /** ⚠️ 无据待核 */
  ungroundedCount: number;
  /** 🔭 跨部门矛盾 */
  conflictCount: number;
}

export interface CourtSessionLatest {
  /** 今日朝会是否已生成；false = 优雅空态 */
  available: boolean;
  /** 朝报日期，如 "2026-06-22" */
  stamp: string;
  /** 《今日朝报》markdown 全文 */
  content: string;
  summary: CourtSessionSummary;
}
