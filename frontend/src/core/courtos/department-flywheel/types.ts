import type { RealityState } from '@/lib/reality/reality-state';

export type DeptId = 'hubu' | 'bingbu';

/** 源任务的最小投影(从 listPrimaryTasks 行映射来)。 */
export interface SourceTask {
  id: string;
  title: string;
  command: string;
  status: string;
  updatedAt: string;
  /**
   * 源任务自带的来源标(来自其 result_json.sourceLabel,原样字符串)。
   * 铁律2:derive 据此标真源,禁把 FALLBACK/DEMO 源漂白成 LIVE。缺省=未标记。
   */
  sourceLabel?: string;
}

/** 部门加工后产出的待决项草案(还没写库)。 */
export interface RaiseDraft {
  sourceTaskId: string;
  /** 写入主库的 command(陛下在上书房看到的待决问题)。 */
  command: string;
  title: string;
  /** 优先级评分,用于每轮上限排序(高优先在前)。null 视为最低。 */
  priority: number | null;
  reality: RealityState;
  /** 写进 result_json 的部门元数据(来源可区分 + 教学注解)。 */
  meta: Record<string, unknown>;
}

export interface DeptHooks {
  dept: DeptId;
  /** 从主库任务里筛本部门语义候选。 */
  selectCandidates(tasks: SourceTask[]): SourceTask[];
  /** 阈值门:够格才产(true=放行)。 */
  passesThreshold(task: SourceTask): boolean;
  /** 加工成待决项草案;不够格/无法加工返回 null。 */
  derive(task: SourceTask): RaiseDraft | null;
}

export interface FlywheelConfig {
  /** 每轮每部最多产几条。 */
  maxPerRun: number;
}

export interface RaisedLedgerEntry {
  sourceTaskId: string;
  dept: DeptId;
  contentHash: string;
  raisedTaskId: string;
  at: string;
}

export interface FlywheelRunResult {
  dept: DeptId;
  scanned: number;
  candidates: number;
  passedGate: number;
  deduped: number;
  raised: { raisedTaskId: string; sourceTaskId: string }[];
  skipped: { sourceTaskId: string; reason: string }[];
}
