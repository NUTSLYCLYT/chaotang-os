/**
 * 朝堂 OS · 丞相编排 API 契约
 *
 * 来源：src/prime-minister/prime-minister.controller.ts (POST /preview, /dispatch)
 *
 * 注：lib/api.ts 已经把 { success, data } 包裹解包，前端拿到的就是内层 data。
 * 这里的 schema 定义的是 data 部分的形状。
 */

import { z } from 'zod';
import type { AgentCode } from './agent';
import {
  PRIME_MINISTER_DEPARTMENT_CODES,
  departmentNameCn,
  type PrimeMinisterDepartmentCode,
} from './dept';

/* ==========================================================================
   Department code (后端使用 8 部 + 钦天监；不含 prime_minister/scribe/tai_yi_yuan)
   ========================================================================== */

export const DEPARTMENT_CODES = PRIME_MINISTER_DEPARTMENT_CODES;
export type DepartmentCode = PrimeMinisterDepartmentCode;

/** 部门代号 → 中文显示名（用于拆解卡） */
export const DEPARTMENT_NAME_CN: Record<DepartmentCode, string> = Object.fromEntries(
  DEPARTMENT_CODES.map((code) => [code, departmentNameCn(code)]),
) as Record<DepartmentCode, string>;

/* ==========================================================================
   Task type (与后端 intent-parser 对齐)
   ========================================================================== */

export const PMTaskTypeSchema = z.enum([
  'analysis',
  'strategy',
  'execution',
  'creative',
  'compliance',
  'forecast',
  'general',
  'intel',
  'health',
]);

export type PMTaskType = z.infer<typeof PMTaskTypeSchema>;

export const TASK_TYPE_LABEL: Record<PMTaskType, string> = {
  analysis: '分析研判',
  strategy: '战略规划',
  execution: '执行落地',
  creative: '创意营销',
  compliance: '合规审查',
  forecast: '趋势推演',
  general: '通用任务',
  intel: '情报扫描',
  health: '健康管理',
};

/* ==========================================================================
   Subtask
   ========================================================================== */

export const PMSubtaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  assignedDepartment: z.string(),
  dependsOn: z.array(z.string()).default([]),
  priority: z.number().default(0),
});

export type PMSubtask = z.infer<typeof PMSubtaskSchema>;

/* ==========================================================================
   Preview response (POST /prime-minister/preview)
   ========================================================================== */

export const PMPreviewSourceSchema = z.enum(['llm', 'rule']);
export type PMPreviewSource = z.infer<typeof PMPreviewSourceSchema>;

export const PMPreviewSchema = z.object({
  intent: z.string(),
  taskType: PMTaskTypeSchema,
  departments: z.array(z.string()),
  needsObservatory: z.boolean(),
  escalationFlags: z.array(z.string()).default([]),
  subtasks: z.array(PMSubtaskSchema),
  dependencyGraph: z.record(z.string(), z.array(z.string())).default({}),
  aggregationStrategy: z.string(),
  source: PMPreviewSourceSchema,
});

export type PMPreview = z.infer<typeof PMPreviewSchema>;

/* ==========================================================================
   Dispatch response (POST /prime-minister/dispatch)
   ========================================================================== */

export const PMDispatchSchema = z.object({
  taskId: z.string(),
  intent: z.string(),
  taskType: PMTaskTypeSchema,
  departments: z.array(z.string()),
  subtasks: z.array(PMSubtaskSchema),
  dispatchedSwarms: z.array(z.string()).default([]),
  source: PMPreviewSourceSchema,
});

export type PMDispatch = z.infer<typeof PMDispatchSchema>;

/* ==========================================================================
   Helpers
   ========================================================================== */

/** 部门代号 → 中文名（兼容未在 DEPARTMENT_CODES 中的代号，回退到原值） */
export function getDepartmentLabel(code: string): string {
  return DEPARTMENT_NAME_CN[code as DepartmentCode] ?? code;
}

/** 与 AgentCode 兼容：某些上下文复用 11 codes，这里保持类型安全的转换 */
export function toAgentCode(code: string): AgentCode {
  return code as AgentCode;
}
