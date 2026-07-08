import { z } from 'zod';

/**
 * 蜂群在圣旨上的统一卡片契约（大神会审 2026-06-08）。
 * displayTier 决定信息架构:headline = 第一眼(≤1 行)、detail = 追问才展开。
 * 设计源:docs/SHENGZHI_INTERACTION_DESIGN_2026-06-08.md。字段名可议,结构不可少。
 */
export const SWARM_DEPTS = [
  'hu_bu', 'gong_bu', 'bing_bu', 'qin_tian_jian', 'jin_yi_wei', 'shi_guan', 'prime_minister',
] as const;

/** 一个数字证据。锦衣卫情报必带 source;钦天监给区间不给点估计;户部数字带单位。 */
export const ZSwarmEvidence = z
  .object({
    value: z.union([z.string(), z.number()]),
    unit: z.string().optional(),
    range: z.tuple([z.number(), z.number()]).optional(),
    source: z.string().optional(),
    asOf: z.string().optional(),
  })
  .passthrough();

export const ZSwarmCard = z
  .object({
    dept: z.enum(SWARM_DEPTS).or(z.string()),
    claim: z.string().min(1),
    evidenceNumber: ZSwarmEvidence.optional(),
    confidence: z.number().min(0).max(1),
    displayTier: z.enum(['headline', 'detail']),
    deepHref: z.string().optional(),
  })
  .passthrough()
  .superRefine((card, ctx) => {
    // 锦衣卫:无来源情报拒收(禁"暂无异常"噪音)。
    if (card.dept === 'jin_yi_wei' && !card.evidenceNumber?.source) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '锦衣卫情报必须带 source(无来源拒收)', path: ['evidenceNumber', 'source'] });
    }
    // 钦天监:给概率/数值区间,不给点估计。
    if (card.dept === 'qin_tian_jian' && !card.evidenceNumber?.range) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '钦天监须给区间 range(非点估计)', path: ['evidenceNumber', 'range'] });
    }
    // 户部:数字带单位。
    if (card.dept === 'hu_bu' && card.evidenceNumber && !card.evidenceNumber.unit) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '户部数字须带 unit', path: ['evidenceNumber', 'unit'] });
    }
    // 史馆:当下隐身,只能折叠在 detail。
    if (card.dept === 'shi_guan' && card.displayTier !== 'detail') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '史馆当下隐身,displayTier 须为 detail', path: ['displayTier'] });
    }
  });

export type TSwarmCard = z.infer<typeof ZSwarmCard>;
export type TSwarmEvidence = z.infer<typeof ZSwarmEvidence>;
