/**
 * 朝堂 OS · 大殿数据契约
 *
 * SoT: src/lib/contracts/dadian.ts
 * 大殿页面所有数据形状定义 — 脉搏指标、动态奏报、下旨结果、COURT_TOOLS
 */

import type { AgentCode } from './agent';

// =========================================================================
// 朝堂脉搏 — /api/court/dadian/pulse
// =========================================================================

export interface DadianPulseData {
  /** 运行中任务总数 */
  activeTasks: number;
  /** 风险预警条目数 */
  riskCount: number;
  /** 机遇发现条目数 */
  opportunityCount: number;
  /** 活跃智囊数（swarm_activity 或在线 agent 数） */
  swarmActivity: number;
  /** 今日奏折数 */
  memorialsToday: number;
  /** 待审批决策数 */
  pendingDecisions: number;
  /** 数据来源: real = Turso 查询, fallback = 无 DB 回落默认值 */
  source: 'real' | 'fallback';
  generatedAt: string;
}

// =========================================================================
// 动态奏报 — /api/court/dadian/feed
// =========================================================================

export type FeedItemStatus = '执行中' | '待审' | '已结';

/** 朝堂最新动态条目（来自 Turso memorials / tasks 表） */
export interface DadianFeedItem {
  id: string;
  /** 涉及部门标签（可多个） */
  depts: string[];
  title: string;
  status: FeedItemStatus;
  /** 相对时间描述，如 "10分钟前" */
  time: string;
  /** 关联任务 ID（可选，用于跳转详情） */
  taskId?: string;
  agentCode?: AgentCode;
}

export interface DadianFeedResponse {
  items: DadianFeedItem[];
  /** 底部通知栏文字（最新动态摘要） */
  notice: string;
  source: 'real' | 'fallback';
  generatedAt: string;
}

// =========================================================================
// 下旨 → /api/orchestration/run SSE 结果
// =========================================================================

/** 三省审议流水线各阶段 citation 来源 */
export interface CourtCitation {
  /** 来源大臣 / 部门代号 */
  agentCode: AgentCode;
  /** 来源大臣中文名 */
  agentName: string;
  /** 引用摘要文本 */
  excerpt: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 时间戳 */
  at: string;
}

/** COURT_TOOLS 工具调用结果包装 */
export interface CourtToolResult {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  agentCode: AgentCode;
  at: string;
}

/** 下旨 SSE 最终 pipeline_done 事件数据形状 */
export interface OrchestrationResult {
  taskId?: string;
  command: string;
  summary: string;
  /** LLM 增强：各部门引用依据 */
  citations: CourtCitation[];
  /** 工具调用记录 */
  toolResults: CourtToolResult[];
  /** 成功分发到的部门 */
  dispatchedTo: string[];
  /** pipeline 耗时 ms */
  durationMs: number;
  completedAt: string;
}

// =========================================================================
// COURT_TOOLS 工具清单（LLM function-calling 注册用）
// =========================================================================

export interface CourtTool {
  name: string;
  description: string;
  /** 对应哪个 agent 执行该工具 */
  agentCode: AgentCode;
  /** JSON Schema 参数定义（简化版） */
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export const COURT_TOOLS: CourtTool[] = [
  {
    name: 'query_task_stats',
    description: '查询当前任务统计：运行中、待审、已结的数量',
    agentCode: 'prime_minister',
    parameters: {
      status: { type: 'string', description: '可选过滤: running|pending|completed', required: false },
    },
  },
  {
    name: 'query_risk_alerts',
    description: '查询最新风险预警条目',
    agentCode: 'jin_yi_wei',
    parameters: {
      limit: { type: 'number', description: '最多返回条数，默认 10', required: false },
    },
  },
  {
    name: 'query_opportunities',
    description: '查询机遇发现列表（情报蜂群输出）',
    agentCode: 'qin_tian_jian',
    parameters: {
      limit: { type: 'number', description: '最多返回条数，默认 5', required: false },
    },
  },
  {
    name: 'query_memorials',
    description: '查询奏折列表（最新奏报）',
    agentCode: 'scribe',
    parameters: {
      status: { type: 'string', description: '可选过滤: pending|running|approved|archived', required: false },
      limit: { type: 'number', description: '最多返回条数，默认 10', required: false },
    },
  },
  {
    name: 'dispatch_decree',
    description: '将皇帝旨意分发给指定部门大臣执行',
    agentCode: 'prime_minister',
    parameters: {
      command: { type: 'string', description: '旨意正文', required: true },
      tone: { type: 'string', description: '语气: 常规|郑重|严厉|宽和', required: false },
      secrecy: { type: 'string', description: '密级: 公开|内阁|密|机要', required: false },
      targetDepts: { type: 'string', description: '目标部门（逗号分隔）', required: false },
    },
  },
  {
    name: 'query_agent_status',
    description: '查询各部门大臣当前状态（idle/running/completed/failed）',
    agentCode: 'scribe',
    parameters: {
      agentCode: { type: 'string', description: '可选：指定单个 agent code', required: false },
    },
  },
  {
    name: 'query_swarm_activity',
    description: '查询蜂群活跃度和正在执行的任务',
    agentCode: 'prime_minister',
    parameters: {
      limit: { type: 'number', description: '最多返回条数，默认 5', required: false },
    },
  },
];
