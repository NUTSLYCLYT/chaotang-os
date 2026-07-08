/**
 * 锦衣卫反查钦天监(2026-07-04 · 任务7)
 *
 * 现状是单向：锦衣卫 → 喂信号 → 钦天监。这里加反向抽查——钦天监某预测声称引用了信号 X，
 * 锦衣卫核对 X 是否**还在最新情报流里**(没被撤/没过期/真的存在)。两部门互相制衡，不单向信任。
 * 与 source-gates.ts「LIVE 标签是否有真 URL」的诚实闸同源思路：引用了就必须经得起核对。
 * 纯函数、渲染时检查，不碰后端、不接 cron(铁律5/9)。域归属：情报=锦衣卫 owner(铁律6)。
 */
import type { DepartmentLearningRecord } from '@/lib/contracts/department-learning';
import type { IntelSignal } from '@/lib/contracts/intel';

export interface CitationAudit {
  recordId: string;
  citedCount: number;
  /** 引用了、但最新情报流里已找不到的信号 id(被撤/过期/从来不存在)。 */
  missingSignalIds: string[];
  /** 全部引用都还在 → true。 */
  clean: boolean;
}

/**
 * 抽查所有引用了情报信号的部门学习记录：引用的 citedSignalIds 是否都还在最新信号流里。
 * 只返回真有引用(citedCount>0)的记录——无引用的(RULE_SEED)本就不该被反查。
 */
export function auditQintianCitations(
  records: DepartmentLearningRecord[],
  latestSignals: IntelSignal[],
): CitationAudit[] {
  const liveIds = new Set(latestSignals.map((s) => s.id));
  return records
    .map((record) => {
      const cited = record.citedSignalIds ?? [];
      const missingSignalIds = cited.filter((id) => !liveIds.has(id));
      return {
        recordId: record.id,
        citedCount: cited.length,
        missingSignalIds,
        clean: missingSignalIds.length === 0,
      };
    })
    .filter((audit) => audit.citedCount > 0);
}
