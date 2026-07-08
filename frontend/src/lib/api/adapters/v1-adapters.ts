/**
 * V1 → V2 数据形状适配器
 *
 * V1 后端（apps/api）的响应形状与 V2 类型有细微差异，
 * 主要是 plan 里的 subtasks / assignedDepartments / dependencyGraph 是 JSON 字符串，
 * 需要在前端解析成结构化对象。
 *
 * 所有适配器都是纯函数，不依赖 store。
 */

import type { Task, TaskPlan, Subtask } from '@/types/task';
import type { AgentCode, AgentRun } from '@/types/agent';
import type { Report, ReportSection } from '@/types/report';

/* ==========================================================================
   工具
   ========================================================================== */

function safeParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') {
    return (raw ?? fallback) as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/* ==========================================================================
   V1 契约校验
   --------------------------------------------------------------------------
   边界保护：V1 后端 schema 漂移时，前端需要 loud 但 graceful 地降级。
   - V1ContractError 是专用错误类，便于上层日志识别
   - assertV1Task 在适配前做最小必要字段校验
   - 校验失败时抛 V1ContractError → safeReal 捕获 → 自动回落到 mock
   ========================================================================== */

export class V1ContractError extends Error {
  constructor(
    public readonly entity: string,
    public readonly missingField: string,
    public readonly raw: unknown,
  ) {
    super(`V1 contract violation: ${entity}.${missingField} missing or invalid`);
    this.name = 'V1ContractError';
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * 校验 V1 后端返回的 task 是否包含 V2 适配所需的最小字段集。
 * 校验失败抛 V1ContractError，由 client.ts 的 safeReal 捕获并 fallback 到 mock。
 */
export function assertV1Task(raw: unknown): asserts raw is V1Task {
  if (!raw || typeof raw !== 'object') {
    throw new V1ContractError('Task', '<root>', raw);
  }
  const r = raw as Record<string, unknown>;
  if (!isStr(r.id)) throw new V1ContractError('Task', 'id', raw);
  if (!isStr(r.title)) throw new V1ContractError('Task', 'title', raw);
  if (!isStr(r.status)) throw new V1ContractError('Task', 'status', raw);
  if (!isStr(r.mode)) throw new V1ContractError('Task', 'mode', raw);
  if (!isStr(r.createdAt)) throw new V1ContractError('Task', 'createdAt', raw);
  if (!isStr(r.updatedAt)) throw new V1ContractError('Task', 'updatedAt', raw);
  // rawCommand 容错为空字符串（adapter 已有 ?? '' 兜底）
}

/** 批量校验，过滤掉不合契约的条目并 console.warn，避免一条坏数据让整个列表 fallback */
export function partitionValidTasks(rawList: unknown[]): {
  valid: V1Task[];
  invalid: Array<{ index: number; error: V1ContractError }>;
} {
  const valid: V1Task[] = [];
  const invalid: Array<{ index: number; error: V1ContractError }> = [];
  rawList.forEach((raw, index) => {
    try {
      assertV1Task(raw);
      valid.push(raw);
    } catch (err) {
      if (err instanceof V1ContractError) {
        invalid.push({ index, error: err });
      } else {
        throw err;
      }
    }
  });
  return { valid, invalid };
}

/* ==========================================================================
   Task
   ========================================================================== */

/** V1 原始 task 形状（从 /api/tasks 返回） */
interface V1Task {
  id: string;
  title: string;
  description?: string;
  rawCommand: string;
  status: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  plan?: V1TaskPlan | null;
  departmentRuns?: V1DepartmentRun[];
  events?: V1EventLog[];
  report?: V1Report | null;
  result?: Record<string, unknown> | null;
}

interface V1TaskPlan {
  id: string;
  taskId: string;
  intent: string;
  taskType: string;
  /** JSON string */
  subtasks: string;
  /** JSON string */
  assignedDepartments: string;
  /** JSON string */
  dependencyGraph: string;
  aggregationStrategy: string;
  clarificationNeeded: boolean;
  /** JSON string */
  escalationFlags: string;
  createdAt: string;
}

interface V1DepartmentRun {
  id: string;
  taskId: string;
  planId: string;
  department: string;
  status: string;
  /** JSON string */
  input: string;
  /** JSON string or null */
  output: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface V1NodeRun {
  id: string;
  taskId: string;
  planId: string;
  department: string;
  status: string;
  subtaskId: string;
  description: string;
  assignedNodeId: string;
  assignedNode?: {
    id: string;
    node_type?: string;
    maturity?: string;
  } | null;
  routingNodeIds: string[];
  startedAt?: string | null;
  completedAt?: string | null;
  output?: string | ParsedDeptOutput | null;
}

interface V1EventLog {
  id: string;
  taskId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

interface V1Report {
  id: string;
  taskId: string;
  executiveSummary: string;
  coreRecommendations: string;
  /** JSON string */
  departmentConclusions: string;
  riskWarnings: string;
  observatoryForecast: string;
  reviewActions: string;
  createdAt: string;
}

/* ==========================================================================
   Task 适配
   ========================================================================== */

export function adaptV1Task(raw: V1Task): Task {
  // 边界校验：契约不符立即抛 V1ContractError，由 safeReal 捕获并 fallback
  assertV1Task(raw);
  const plan = raw.plan ? adaptV1Plan(raw.plan) : undefined;
  return {
    id: raw.id,
    title: raw.title,
    rawCommand: raw.rawCommand ?? '',
    description: raw.description,
    status: raw.status as Task['status'],
    mode: raw.mode as Task['mode'],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    plan,
    result: raw.result ?? undefined,
  };
}

export function adaptV1Plan(raw: V1TaskPlan): TaskPlan {
  const parsedSubtasks = safeParse<
    | Subtask[]
    | {
        items?: Subtask[];
        routingPlan?: {
          assignedNodeIds?: string[];
          executionNodeIds?: string[];
          governanceNodeIds?: string[];
          runtimeNodeIds?: string[];
          humanNodeIds?: string[];
        };
      }
  >(raw.subtasks, []);
  const subtaskItems = Array.isArray(parsedSubtasks) ? parsedSubtasks : (parsedSubtasks.items ?? []);
  const subtasks = subtaskItems.map((st) => ({
    id: st.id,
    taskId: raw.taskId,
    description: st.description,
    assignedAgent: (st as unknown as { assignedDepartment: AgentCode }).assignedDepartment,
    dependsOn: st.dependsOn ?? [],
    priority: st.priority ?? 1,
    progressPct: 0,
  }));
  const assignedAgents = safeParse<AgentCode[]>(raw.assignedDepartments, []);
  const dependencyGraph = safeParse<Record<string, string[]>>(raw.dependencyGraph, {});
  const escalationFlags = safeParse<string[]>(raw.escalationFlags, []);

  void subtasks; // 当前 V2 Task 不存 subtasks 数组，只走 dependencyGraph；保留以便将来使用

  return {
    id: raw.id,
    taskId: raw.taskId,
    intent: raw.intent,
    taskType: raw.taskType as TaskPlan['taskType'],
    assignedAgents,
    assignedNodeIds: Array.isArray(parsedSubtasks) ? [] : (parsedSubtasks.routingPlan?.assignedNodeIds ?? []),
    executionNodeIds: Array.isArray(parsedSubtasks) ? [] : (parsedSubtasks.routingPlan?.executionNodeIds ?? []),
    governanceNodeIds: Array.isArray(parsedSubtasks) ? [] : (parsedSubtasks.routingPlan?.governanceNodeIds ?? []),
    runtimeNodeIds: Array.isArray(parsedSubtasks) ? [] : (parsedSubtasks.routingPlan?.runtimeNodeIds ?? []),
    humanNodeIds: Array.isArray(parsedSubtasks) ? [] : (parsedSubtasks.routingPlan?.humanNodeIds ?? []),
    dependencyGraph,
    aggregationStrategy: raw.aggregationStrategy as TaskPlan['aggregationStrategy'],
    escalationFlags,
    clarificationNeeded: raw.clarificationNeeded ?? false,
    createdAt: raw.createdAt,
  };
}

/* ==========================================================================
   AgentRun 适配 —— 从 V1 department runs 派生
   ========================================================================== */

interface ParsedDeptOutput {
  departmentSummary?: string;
  riskFlags?: string[];
  confidenceLevel?: number;
  [key: string]: unknown;
}

const V1_STATUS_TO_AGENT_STATE: Record<string, AgentRun['state']> = {
  pending: 'assigned',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  fallback: 'fallback_completed',
};

export function adaptV1DepartmentRuns(runs: V1DepartmentRun[]): AgentRun[] {
  return runs.map((run) => {
    const parsedInput = safeParse<{
      subtaskId?: string;
      assignedNodeId?: string;
      routingNodeIds?: string[];
    }>(run.input, {});
    const output = safeParse<ParsedDeptOutput>(run.output, {});
    const summary = output?.departmentSummary;
    const confidence = output?.confidenceLevel;
    const riskFlags = output?.riskFlags ?? [];
    const riskLevel: AgentRun['riskLevel'] | undefined = riskFlags.length
      ? riskFlags.length >= 3
        ? 'high'
        : 'medium'
      : undefined;

    return {
      id: run.id,
      taskId: run.taskId,
      subtaskId: parsedInput.subtaskId ?? run.id,
      agentCode: run.department as AgentCode,
      assignedNodeId: parsedInput.assignedNodeId,
      routingNodeIds: parsedInput.routingNodeIds ?? [],
      state: V1_STATUS_TO_AGENT_STATE[run.status] ?? 'idle',
      progressPct: run.status === 'completed' ? 100 : run.status === 'running' ? 60 : 0,
      currentTaskTitle: summary?.slice(0, 60),
      latestSummary: summary,
      riskLevel,
      isWaitingDependency: false,
      hasReported: run.status === 'completed',
      confidence,
      startedAt: run.startedAt ?? undefined,
      completedAt: run.completedAt ?? undefined,
    };
  });
}

export function adaptV1NodeRuns(runs: V1NodeRun[]): AgentRun[] {
  return runs.map((run) => {
    const output = typeof run.output === 'string'
      ? safeParse<ParsedDeptOutput>(run.output, {})
      : ((run.output ?? {}) as ParsedDeptOutput);
    const summary = output?.departmentSummary || run.description;
    const confidence = output?.confidenceLevel;
    const riskFlags = output?.riskFlags ?? [];
    const riskLevel: AgentRun['riskLevel'] | undefined = riskFlags.length
      ? riskFlags.length >= 3
        ? 'high'
        : 'medium'
      : undefined;

    return {
      id: run.id,
      taskId: run.taskId,
      subtaskId: run.subtaskId ?? run.id,
      agentCode: run.department as AgentCode,
      assignedNodeId: run.assignedNodeId,
      routingNodeIds: run.routingNodeIds ?? [],
      nodeType: run.assignedNode?.node_type,
      nodeMaturity: run.assignedNode?.maturity,
      state: V1_STATUS_TO_AGENT_STATE[run.status] ?? 'idle',
      progressPct: run.status === 'completed' ? 100 : run.status === 'running' ? 60 : 0,
      currentTaskTitle: run.description || summary?.slice(0, 60),
      latestSummary: summary,
      riskLevel,
      isWaitingDependency: false,
      hasReported: run.status === 'completed',
      confidence,
      startedAt: run.startedAt ?? undefined,
      completedAt: run.completedAt ?? undefined,
    };
  });
}

/* ==========================================================================
   Report 适配 —— V1 的 6 段结构 → V2 的 sections array
   ========================================================================== */

export function adaptV1Report(raw: V1Report, title?: string): Report {
  const departmentConclusions = safeParse<unknown[]>(raw.departmentConclusions, []);

  const sections: ReportSection[] = [
    { id: 's1', title: '御前摘要', kind: 'text', content: raw.executiveSummary, order: 1 },
    { id: 's2', title: '核心建议', kind: 'markdown', content: raw.coreRecommendations, order: 2 },
    { id: 's3', title: '各部结论', kind: 'list', content: departmentConclusions, order: 3 },
    { id: 's4', title: '风险提示', kind: 'text', content: raw.riskWarnings, order: 4 },
    { id: 's5', title: '钦天推演', kind: 'text', content: raw.observatoryForecast, order: 5 },
    { id: 's6', title: '批示动作', kind: 'text', content: raw.reviewActions, order: 6 },
  ];

  return {
    id: raw.id,
    taskId: raw.taskId,
    template: 'strategy_report',
    title: title ?? '朝堂呈报',
    subtitle: '来自 V1 真实后端 · 丞相府呈报',
    createdAt: raw.createdAt,
    sections,
    metadata: {
      author: '丞相府',
      audience: '陛下',
      version: 1,
      contributingAgents: ['prime_minister', 'hu_bu', 'gong_bu', 'li_bu_rites'],
    },
  };
}

/* ==========================================================================
   Helper：完整 task（含 runs + report）→ V2 Task + runs + report
   ========================================================================== */

export function adaptV1FullTask(raw: V1Task): {
  task: Task;
  runs: AgentRun[];
  report: Report | null;
} {
  const task = adaptV1Task(raw);
  const runs = raw.departmentRuns ? adaptV1DepartmentRuns(raw.departmentRuns) : [];
  const report = raw.report ? adaptV1Report(raw.report, raw.title) : null;
  return { task, runs, report };
}
