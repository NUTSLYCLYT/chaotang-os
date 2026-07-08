import { z } from 'zod';

/**
 * 丞相裁断对象 —— 圣旨头版那句话的生成者(大神会审 2026-06-08)。
 * 铁律:丞相做【裁断】不做【汇总】;用户只需【准奏】一键,老板确认即可(追问/驳回为备选)。
 * 设计源:docs/SHENGZHI_INTERACTION_DESIGN_2026-06-08.md + SHENGZHI_ACCEPTANCE_SPEC_2026-06-08.md。
 */
export const REVERSIBILITY = ['one_way_door', 'two_way_door'] as const; // 单向门/双向门(单一真相源)

/** 用户对丞相裁断的处置:默认只需「准奏」;对齐已上线 ApprovalActionBar + 治理 FSM(准奏/追问/驳回)。 */
export const USER_DISPOSITIONS = ['准奏', '追问', '驳回'] as const;

/** 失信废话词:type 层强制反"正确的废话",与 scripts/verify-edict-quality.mjs 的 WEASEL 镜像。 */
export const WEASEL_PHRASES = [
  '综合考虑', '综合评估', '谨慎决策', '审慎决策', '平衡风险', '小步快跑',
  '妥善处理', '加强沟通', '密切关注', '结合自身情况', '保持沟通', '需要进一步',
] as const;

export const ZConflictResolved = z
  .object({
    between: z.array(z.string()).min(2), // 哪些部门间的矛盾(户部 vs 兵部…)
    ruling: z.string().min(1),           // 丞相替你裁的结论
  })
  .passthrough();

export const ZChancellorDecision = z
  .object({
    verdict: z.string().min(1),     // 第一行硬判(推/不推·上/不上·放/不放)
    theOneThing: z.string().min(1), // 现在唯一要做的(本周一件)
    theThingToNotDo: z.object({
      action: z.string().min(1),    // 明确点名"绝不做/暂缓"的那件 —— 最反直觉最值钱
      reason: z.string().min(1),
    }),
    conflictsResolved: z.array(ZConflictResolved).min(1), // 必须裁掉≥1个跨部冲突(裁断非汇总)
    reversibility: z.enum(REVERSIBILITY),
    signoff: z.object({
      required: z.boolean(), // 由 不可逆 × 现金流占比 触发(非难度,非永远 true) —— 本对象为 signoff 单一真相源
      basis: z.string(),
    }),
    // 用户准奏即可:丞相已裁断,老板默认一键准奏;追问/驳回为备选。
    userDispositions: z.array(z.enum(USER_DISPOSITIONS)).default(['准奏', '追问', '驳回']),
    defaultDisposition: z.literal('准奏').default('准奏'),
  })
  .passthrough()
  .superRefine((d, ctx) => {
    // anti-正确废话:裁断不能是 weasel 套话(verdict / 绝不做那件)。
    const guard = (val: unknown, path: (string | number)[]) => {
      if (typeof val === 'string' && WEASEL_PHRASES.some((w) => val.includes(w))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '裁断含失信废话词(须可签字,非套话)', path });
      }
    };
    guard(d.verdict, ['verdict']);
    guard(d.theThingToNotDo?.action, ['theThingToNotDo', 'action']);
  });

export type TChancellorDecision = z.infer<typeof ZChancellorDecision>;
export type TConflictResolved = z.infer<typeof ZConflictResolved>;
