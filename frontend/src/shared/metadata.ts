/**
 * 部门 / 状态 / 事件 元数据 —— 唯一来源
 *
 * 前端、后端、文档都从这里读取，避免散落在各处的硬编码。
 */

import { Department, TaskStatus, EventType, ExecutionMode } from './enums';

// ===== 部门元数据 =====

export interface DepartmentMeta {
  code: Department;
  /** 中文短名 */
  name: string;
  /** 中文职责描述 */
  description: string;
  /** 表情/图标占位（前端可覆盖） */
  emoji: string;
  /** 是否为 P0 真实能力部门（false 表示 P0 模板） */
  isCore: boolean;
  /** 是否前瞻层（钦天监独有） */
  isObservatory: boolean;
}

export const DEPARTMENT_META: Record<Department, DepartmentMeta> = {
  [Department.Revenue]: {
    code: Department.Revenue,
    name: '户部',
    description: '金融投资·股票分析·估值·资产配置',
    emoji: '💰',
    isCore: true,
    isObservatory: false,
  },
  [Department.Works]: {
    code: Department.Works,
    name: '工部',
    description: '产品·技术·工程·实施交付',
    emoji: '🛠',
    isCore: true,
    isObservatory: false,
  },
  [Department.Rites]: {
    code: Department.Rites,
    name: '礼部',
    description: '品牌·营销·短视频·内容',
    emoji: '🎨',
    isCore: true,
    isObservatory: false,
  },
  [Department.Observatory]: {
    code: Department.Observatory,
    name: '钦天监',
    description: '趋势·推演·风险窗口·前瞻',
    emoji: '🔭',
    isCore: true,
    isObservatory: true,
  },
  [Department.Guard]: {
    code: Department.Guard,
    name: '锦衣卫',
    description: '全球情报·舆情扫描·信号监测·跨境动态',
    emoji: '🛰',
    isCore: true,
    isObservatory: false,
  },
  [Department.Personnel]: {
    code: Department.Personnel,
    name: '吏部',
    description: '组织·人力·招聘·绩效',
    emoji: '👥',
    isCore: false,
    isObservatory: false,
  },
  [Department.Military]: {
    code: Department.Military,
    name: '兵部',
    description: '竞品·战略·攻防·情报',
    emoji: '⚔️',
    isCore: false,
    isObservatory: false,
  },
  [Department.Justice]: {
    code: Department.Justice,
    name: '刑部',
    description: '制度·风控·审计·KPI',
    emoji: '⚖️',
    isCore: false,
    isObservatory: false,
  },
};

export function getDepartmentMeta(code: string): DepartmentMeta | null {
  return (DEPARTMENT_META as Record<string, DepartmentMeta>)[code] ?? null;
}

export const DEPARTMENT_CODES_ORDERED: Department[] = [
  Department.Revenue,
  Department.Works,
  Department.Rites,
  Department.Personnel,
  Department.Military,
  Department.Justice,
  Department.Guard,
  Department.Observatory,
];

// ===== 任务状态元数据 =====

export interface StatusMeta {
  code: TaskStatus;
  label: string;
  /** 流转阶段（用于进度条） */
  step: number;
  /** 颜色提示（前端解析） */
  tone: 'neutral' | 'progress' | 'success' | 'warning';
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  [TaskStatus.Draft]: { code: TaskStatus.Draft, label: '草稿', step: 0, tone: 'neutral' },
  [TaskStatus.Submitted]: { code: TaskStatus.Submitted, label: '已提交', step: 1, tone: 'progress' },
  [TaskStatus.Interpreting]: { code: TaskStatus.Interpreting, label: '丞相解析中', step: 2, tone: 'progress' },
  [TaskStatus.Planning]: { code: TaskStatus.Planning, label: '丞相规划中', step: 3, tone: 'progress' },
  [TaskStatus.Assigned]: { code: TaskStatus.Assigned, label: '已分派部门', step: 4, tone: 'progress' },
  [TaskStatus.Running]: { code: TaskStatus.Running, label: '部门执行中', step: 5, tone: 'progress' },
  [TaskStatus.Aggregating]: { code: TaskStatus.Aggregating, label: '汇总中', step: 6, tone: 'progress' },
  [TaskStatus.ReportReady]: { code: TaskStatus.ReportReady, label: '呈报就绪', step: 7, tone: 'success' },
  [TaskStatus.Reviewed]: { code: TaskStatus.Reviewed, label: '已批示', step: 8, tone: 'success' },
  [TaskStatus.Archived]: { code: TaskStatus.Archived, label: '已归档', step: 9, tone: 'neutral' },
};

export function getStatusMeta(status: string): StatusMeta {
  return (
    (STATUS_META as Record<string, StatusMeta>)[status] ?? {
      code: status as TaskStatus,
      label: status,
      step: -1,
      tone: 'neutral',
    }
  );
}

export const TOTAL_LIFECYCLE_STEPS = 9;

// ===== 事件元数据 =====

export interface EventMeta {
  code: EventType;
  label: string;
  tone: 'neutral' | 'progress' | 'success' | 'warning' | 'danger';
}

export const EVENT_META: Record<EventType, EventMeta> = {
  [EventType.TaskCreated]: { code: EventType.TaskCreated, label: '任务创建', tone: 'progress' },
  [EventType.IntentDetected]: { code: EventType.IntentDetected, label: '意图识别', tone: 'progress' },
  [EventType.SubtaskAssigned]: { code: EventType.SubtaskAssigned, label: '子任务分派', tone: 'progress' },
  [EventType.DepartmentRunning]: { code: EventType.DepartmentRunning, label: '部门执行', tone: 'progress' },
  [EventType.IntermediateResultReady]: {
    code: EventType.IntermediateResultReady,
    label: '中间结果',
    tone: 'success',
  },
  [EventType.RiskAlert]: { code: EventType.RiskAlert, label: '风险预警', tone: 'danger' },
  [EventType.ReportReady]: { code: EventType.ReportReady, label: '呈报就绪', tone: 'success' },
  [EventType.ImperialReviewSubmitted]: {
    code: EventType.ImperialReviewSubmitted,
    label: '御批提交',
    tone: 'success',
  },
  [EventType.MemoryWritten]: { code: EventType.MemoryWritten, label: '记忆存档', tone: 'neutral' },
};

export function getEventMeta(eventType: string): EventMeta {
  return (
    (EVENT_META as Record<string, EventMeta>)[eventType] ?? {
      code: eventType as EventType,
      label: eventType,
      tone: 'neutral',
    }
  );
}

// ===== 模式元数据 =====

export interface ModeMeta {
  code: ExecutionMode;
  label: string;
  description: string;
}

export const MODE_META: Record<ExecutionMode, ModeMeta> = {
  [ExecutionMode.Scripted]: {
    code: ExecutionMode.Scripted,
    label: 'Scripted',
    description: '脚本演示，零依赖、可重放',
  },
  [ExecutionMode.Hybrid]: {
    code: ExecutionMode.Hybrid,
    label: 'Hybrid',
    description: '规则编排 + LLM 增强',
  },
  [ExecutionMode.Live]: {
    code: ExecutionMode.Live,
    label: 'Live',
    description: '全 LLM 实时',
  },
};
