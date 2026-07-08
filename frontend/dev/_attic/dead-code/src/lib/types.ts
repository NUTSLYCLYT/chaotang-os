/**
 * @deprecated 请改用 @/lib/contracts/* 下面的契约文件：
 *   SwarmOverview / SwarmUnit / SwarmMember / SwarmOutput / SwarmOutputArchive /
 *   Interaction / DeptStatus / TaskGroup → @/lib/contracts/swarm
 *   Judgement / JudgementItem → @/lib/contracts/judgement
 *
 * 本文件保留兼容性，待 phase 5 迁移完成后删除。
 * 详见 docs/migration/03-swarm-contract.md §9 切换映射表。
 */

export interface SwarmOverview {
  total: number;
  online: number;
  busy: number;
  blocked: number;
  warning: number;
  completedToday: number;
  needsAttention: number;
}

export interface SwarmUnit {
  id: string;
  name: string;
  status: string;
  priority: string;
  currentTaskTitle?: string;
  needsAttention: boolean;
  progressOverview?: string;
  blockedReason?: string;
  riskSummary?: string;
  missingInput?: string;
  updatedAt: string;
}

export interface Judgement {
  firstPriority: string;
  systemJudgement: string;
  globalStatusTag: string;
  judgementItems?: JudgementItem[];
}

export interface JudgementItem {
  label: string;
  object: string;
  actionHref: string;
}

export interface DeptStatus {
  id: string;
  name: string;
  status: string;
  progressOverview?: string;
  needsAttention?: boolean;
  currentTask?: string;
  isBlocked?: boolean;
  neededInput?: string;
  [key: string]: unknown;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  nextStep?: string;
  owner?: string;
}

export interface TaskGroup {
  priority: string;
  tasks: Task[];
}

export interface Interaction {
  id: string;
  actor: string;
  type: string;
  content: string;
  timestamp?: string;
}

export interface SwarmMember {
  id?: string;
  agentId: string;
  name?: string;
  role?: string;
  status: string;
}

export interface SwarmOutput {
  summary?: string;
  keyFindings?: string[];
  executableNextSteps?: string[];
  risks?: string[];
  pendingConfirmations?: string[];
}

export interface SwarmOutputArchive extends SwarmOutput {
  id: string;
  swarmId: string;
  swarmName?: string;
  swarmStatus?: string;
  updatedAt?: string;
}
