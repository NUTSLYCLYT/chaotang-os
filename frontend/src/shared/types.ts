import { Department, ExecutionMode, TaskStatus, EventType } from './enums';

// ===== 核心实体类型 =====

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  mode: ExecutionMode;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPlan {
  id: string;
  taskId: string;
  intent: string;
  taskType: string;
  subtasks: Subtask[];
  assignedDepartments: Department[];
  dependencyGraph: Record<string, string[]>;
  aggregationStrategy: string;
  clarificationNeeded: boolean;
  escalationFlags: string[];
  createdAt: string;
}

export interface Subtask {
  id: string;
  description: string;
  assignedDepartment: Department;
  dependsOn: string[];
  priority: number;
}

export interface DepartmentRun {
  id: string;
  taskId: string;
  planId: string;
  department: Department;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'fallback';
  input: DepartmentInput;
  output: DepartmentOutput | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface EventLog {
  id: string;
  taskId: string;
  type: EventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface Report {
  id: string;
  taskId: string;
  executiveSummary: string;
  coreRecommendations: string;
  departmentConclusions: DepartmentConclusion[];
  riskWarnings: string;
  observatoryForecast: string;
  reviewActions: string;
  createdAt: string;
}

export interface DepartmentConclusion {
  department: Department;
  summary: string;
  confidence: number;
}

export interface MemoryRecord {
  id: string;
  taskId: string;
  category: string;
  content: string;
  tags: string[];
  createdAt: string;
}

// ===== 部门统一协议 =====

export interface DepartmentInput {
  taskContext: string;
  departmentGoal: string;
  structuredSubtask: Subtask;
  dependencyInputs: Record<string, unknown>;
  attachedMaterials: string[];
  mode: ExecutionMode;
  userConstraints: string[];
}

export interface DepartmentOutput {
  departmentSummary: string;
  detailedFindings: string;
  structuredOutput: Record<string, unknown>;
  riskFlags: string[];
  assumptions: string[];
  nextNeededInputs: string[];
  confidenceLevel: number;
}
