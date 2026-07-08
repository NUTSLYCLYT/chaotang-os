/**
 * 上书房 · 数据契约（Turso 直查版）
 *
 * SoT: lib/contracts/shangshufang.ts
 * 所有上书房页面数据结构从此 import，禁止在组件内内联定义。
 */

import type { Citation } from "./decree";
import type { BlastRadius } from "@/features/governance/lib/gate";

/** 丞相建议条目（来自 Turso tasks 表 + LLM 增强） */
export interface ChancellorItem {
  id: string;
  title: string;
  /** 干支标签，如「甲申 · 急报」 */
  tag: string;
  priority: "urgent" | "high" | "medium" | "low";
  /** 建议来源 */
  source: "turso" | "primary" | "signal" | "ledger";
  /** 推荐下旨命令（可直接预填） */
  suggestedCommand?: string;
  /** 可核验证据，来自 Turso 或外部情报 */
  citations?: Citation[];
  /** 推荐参审大臣代码 */
  recommendedMinisters?: string[];
  /** 贯穿拟旨、会审、裁决、归档的排障追踪 ID */
  loopTraceId?: string;
}

/** 奏折摘要（来自 Turso tasks / decisions 表） */
export interface MemorialItem {
  id: string;
  title: string;
  summary: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: string;
  /** 可裁决主判；来自 result_json / 回传卷轴，不得用占位文案冒充。 */
  verdict?: string;
  petitioner: string;
  reporter: string;
  sealDate: string;
  decisionOptions: string[];
  /** LLM 增强的完整建议段落（有则展示，无则用 summary） */
  enhancedSuggestion?: string;
  /** 来源证据（Turso decisions.citations_json） */
  citations?: Citation[];
  /** 贯穿拟旨、会审、裁决、归档的排障追踪 ID */
  loopTraceId?: string;
}

/** 每日摘要统计（来自 Turso 聚合） */
export interface DailyStats {
  taskTotal: number;
  pendingCount: number;
  runningCount: number;
  completedToday: number;
}

/**
 * 简报数据来源态（真链路纪律：real / fallback / missing 必须可区分）
 *   - real        Turso 命中真实任务/决议
 *   - fallback    Turso 可达但今日无任务，回填本地引导奏折
 *   - unavailable Turso 不可达（宕机/配置缺失），返回兜底骨架——属 missing，
 *                 运维必须能与「今天没事」区分，不得静默冒充成功
 */
export type BriefingSourceMode = "real" | "fallback" | "unavailable";

export interface PersistedEdictReturnRow {
  label: string;
  body: string;
}

export interface PersistedEdictReturnView {
  id: string;
  title: string;
  subtitle?: string;
  meta?: {
    petitioner?: string;
    reporter?: string;
    priority?: MemorialItem["priority"];
    /** 严厉度(blast_radius):持久化往返须保留,否则裁决责任徽/降级在回读后丢失判红信号。 */
    blastRadius?: BlastRadius;
    badges?: Array<{
      label: string;
      tone?: "green" | "amber" | "red" | "blue";
    }>;
  };
  rows: PersistedEdictReturnRow[];
  sealDate?: string;
  seal: "imperial" | "chancellor" | "tutorial" | "secret" | string;
}

export interface PersistedJiqunFinalOutputBlock {
  topic: string;
  swarmId: string | null;
  runId: string | null;
  qualityScore: number | null;
  output: Record<string, unknown>;
}

export interface ShangshufangEdictReturn {
  source: "jiqun_ai";
  taskId: string;
  jiqunTaskId?: string | null;
  sessionId: string;
  mode: "order" | "secret";
  command: string;
  edictView: PersistedEdictReturnView;
  finalOutputs: PersistedJiqunFinalOutputBlock[];
  savedAt: string;
}

/** 上书房今日简报（Turso 直查返回） */
export interface ShangshufangBriefing {
  dailyStats: DailyStats;
  chancellorItems: ChancellorItem[];
  memorials: MemorialItem[];
  fetchedAt: string;
  /** 权威数据来源标注，由 BFF 在数据边界设置；前端读它而非靠 id 前缀推断 */
  sourceMode: BriefingSourceMode;
  latestEdictReturn?: ShangshufangEdictReturn;
}

/** /api/court/shangshufang/briefing 响应信封 */
export interface BriefingResponse {
  success: boolean;
  data: ShangshufangBriefing;
  error?: string;
}

/**
 * 收件箱待裁项来源(SSOT: contracts/agent.ts 11 码 + chancellor)。
 * 后端各源 agent 产出待裁项时以此标 origin，前端据此渲染来源徽。
 */
export type InboxOrigin =
  | "chancellor"
  | "prime_minister"
  | "scribe"
  | "li_bu"
  | "hu_bu"
  | "li_bu_rites"
  | "bing_bu"
  | "xing_bu"
  | "gong_bu"
  | "qin_tian_jian"
  | "jin_yi_wei"
  | "tai_yi_yuan";

/**
 * 五源聚合待裁项（后端 feed 契约，见 dev/notes/上书房-左栏五源聚合-后端feed契约）。
 * = ChancellorItem + origin；只放「待老板拍板的一件事」，禁情报/资料/建案冒充。
 */
export interface InboxItem {
  id: string;
  title: string;
  tag: string;
  priority: "urgent" | "high" | "medium" | "low";
  origin: InboxOrigin;
  source: "turso" | "primary" | "signal" | "ledger";
  suggestedCommand?: string;
  citations?: Citation[];
  recommendedMinisters?: string[];
  loopTraceId?: string;
}

/** 收件箱 feed 信封：sourceMode 必须区分「今天没有(real 空)」与「读不到(unavailable)」。 */
export interface InboxFeed {
  items: InboxItem[];
  sourceMode: BriefingSourceMode;
}

/** 下旨到三省审议流水线的请求体 */
export interface OrchestrationRunBody {
  command: string;
  sessionId?: string;
  taskId?: string;
  petitionId?: string;
}

/** SSE pipeline 阶段事件（前端消费） */
export type PipelineStageEvent =
  | { type: "open"; request_id: string }
  | { type: "stage_start"; stage: string; at: string }
  | { type: "stage_progress"; stage: string; message: string; at: string }
  | { type: "retrieve_done"; tavilyCitations: number; precedents: number; at: string }
  | { type: "zhongshu_done"; draft: { decision: string; rationale: string; citations?: Citation[] }; at: string }
  | { type: "menxia_done"; review: { approved: boolean; comments: string }; at: string }
  | { type: "shangshu_done"; execution: { taskId?: string; steps?: unknown[] }; at: string }
  | { type: "persist_done"; decisionId: string; taskId?: string; at: string }
  | { type: "pipeline_done"; at: string }
  | { type: "eof"; request_id: string }
  | { type: "error"; message: string; request_id: string }
  | { type: "stage_error"; stage: string; message: string; at: string };
