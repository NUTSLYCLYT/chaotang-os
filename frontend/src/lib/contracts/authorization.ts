/**
 * 朝堂 OS · 授权治理数据契约(太子自主运营模式)
 *
 * 来源:chaotang-os 治理引擎(prince/governance.py)收口,嫁接至 xing_bu 刑部·制度风控。
 * 目标位置:apps/web/lib/contracts/authorization.ts
 *
 * 定位:**太子 = 朝廷的「自主运营模式」,非 AgentCode**(11 代号 Tier-0 冻结,严禁增删)。
 * 本契约定义该模式的治理骨架:渐进授权(逐类毕业)/ 高危双签 / 上报 SLA / 政策 diff。
 * 由 prime_minister 编排六部自主执行、xing_bu 制度风控把关,到阈值/高危则 escalate 皇帝。
 *
 * 注:lib/api 已解包 { success, data };此处定义的是 data 形状。
 */

import { z } from 'zod';
import type { AgentCode, RiskLevel } from './agent';

/* ==========================================================================
   执行模式 · 某动作类别当前能否自动执行
   ========================================================================== */

export const ExecModeSchema = z.enum(['propose', 'execute']);
export type ExecMode = z.infer<typeof ExecModeSchema>;

export const EXEC_MODE_LABEL: Record<ExecMode, string> = {
  propose: '只提案 · 待皇帝裁',
  execute: '已毕业 · 自动执行',
};

/* ==========================================================================
   治理裁决 · 与 memorial 审批态对齐(approve→approved / escalate→pending / block→rejected)
   ========================================================================== */

export const AuthVerdictSchema = z.enum(['approve', 'escalate', 'block']);
export type AuthVerdict = z.infer<typeof AuthVerdictSchema>;

export const AUTH_VERDICT_LABEL: Record<AuthVerdict, string> = {
  approve: '准·可执行',
  escalate: '伏候圣裁',
  block: '按律拦下',
};

/* ==========================================================================
   动作类别 · 渐进授权的累计单元(由 部门 × 风险 派生)
   ========================================================================== */

/** 动作类别键,约定形如 `hu_bu:medium`(部门代号:风险级) */
export type ActionClass = string;

export function makeActionClass(department: AgentCode | string, risk: RiskLevel): ActionClass {
  return `${department}:${risk}`;
}

/* ==========================================================================
   授权进度 · 渐进授权状态机(逐类从 propose 毕业到 execute)
   ========================================================================== */

export const AuthorizationGrantSchema = z.object({
  actionClass: z.string(),
  approvals: z.number().int().default(0),
  rejections: z.number().int().default(0),
  graduated: z.boolean().default(false),
  /** 高危类锁死:永不毕业,永远 escalate */
  highRiskLocked: z.boolean().default(false),
  /** 连续批准达此阈值则毕业(默认 5) */
  graduateThreshold: z.number().int().default(5),
});
export type AuthorizationGrant = z.infer<typeof AuthorizationGrantSchema>;

/* ==========================================================================
   高危双签 · 两个独立审批(成本视角 ∧ 风险视角)均同意才放行
   ========================================================================== */

export const DualSignSchema = z.object({
  required: z.boolean(),
  costApprover: z.boolean().nullable().default(null),
  riskApprover: z.boolean().nullable().default(null),
  passed: z.boolean().default(false),
});
export type DualSign = z.infer<typeof DualSignSchema>;

/* ==========================================================================
   上报 · 人机断点 + SLA 超时默断(皇帝不回不卡死)
   ========================================================================== */

export const EscalationSchema = z.object({
  id: z.string(),
  actionClass: z.string(),
  /** 发起部门(11 AgentCode 之一) */
  department: z.string(),
  reason: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  createdAt: z.string(),
  slaSeconds: z.number().int().default(3600),
  /** 超时未裁则按此默断(信息类可设 approve,涉钱涉危默认 block) */
  defaultOnTimeout: AuthVerdictSchema.default('block'),
  resolved: AuthVerdictSchema.nullable().default(null),
  resolvedBy: z.string().default(''),
});
export type Escalation = z.infer<typeof EscalationSchema>;

/* ==========================================================================
   政策 diff 提案 · 毕业/驳回自动产出,待皇帝一键合并入 policy 版本
   ========================================================================== */

export const PolicyDiffSchema = z.object({
  actionClass: z.string(),
  proposedRule: z.enum(['auto_approve', 'auto_block']),
  evidence: z.object({
    approvals: z.number().int(),
    rejections: z.number().int(),
  }),
  note: z.string(),
});
export type PolicyDiff = z.infer<typeof PolicyDiffSchema>;

/* ==========================================================================
   分部政策 · 各部不同阈值(户部最严 / 钦天监最松 / 丞相级一律上报)
   ========================================================================== */

export const MinistryPolicySchema = z.object({
  department: z.string(),
  /** 单笔成本上限(超则 block) */
  perTxCap: z.number(),
  /** 超此额自动上报(escalate) */
  autoEscalateAbove: z.number(),
});
export type MinistryPolicy = z.infer<typeof MinistryPolicySchema>;

/* ==========================================================================
   Helpers · 纯函数,无副作用(状态转移逻辑放 feature lib,契约只给判定)
   ========================================================================== */

/** 该动作类别现在能自动执行吗(高危/未毕业 → 仅提案)。 */
export function execModeFor(grant: AuthorizationGrant, risk: RiskLevel): ExecMode {
  if (grant.highRiskLocked || risk === 'high' || risk === 'critical') return 'propose';
  return grant.graduated ? 'execute' : 'propose';
}

/** 双签是否通过(两个审批器都为 true)。 */
export function dualSignPassed(sign: DualSign): boolean {
  return sign.required ? sign.costApprover === true && sign.riskApprover === true : true;
}

/** 上报是否已超 SLA(传入当前 epoch 秒与创建 epoch 秒)。 */
export function isEscalationOverdue(esc: Escalation, nowEpoch: number, createdEpoch: number): boolean {
  return esc.resolved === null && nowEpoch >= createdEpoch + esc.slaSeconds;
}
