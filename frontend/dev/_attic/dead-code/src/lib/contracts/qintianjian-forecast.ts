import { z } from 'zod';

/**
 * 钦天监前瞻契约(大神会审 2026-06-08):反"占卜剧场"——必须给可证伪刹车阈值、分不变量/变量、预判尾部。
 * 设计源:docs/SHENGZHI_ACCEPTANCE_SPEC_2026-06-08.md 铁律3。
 */
export const ZForecastThreshold = z
  .object({
    signal: z.string().min(1),  // 看什么信号(碳酸锂价 / 良率…)
    trigger: z.string().min(1), // 阈值(跌破 X / 连 N 月不过 90%)
    action: z.string().min(1),  // 一亮就做什么(立刻砍 / 停)
  })
  .passthrough();

export const ZQintianjianForecast = z
  .object({
    thresholds: z.array(ZForecastThreshold).min(1), // 至少一条可证伪刹车阈值
    invariants: z.array(z.string()),                // 5 年不变量(押这个)
    variables: z.array(z.string()),                 // 变量(别赌运气)
    tail_risk: z.string().min(1),                   // 尾部/最坏(非平均值)
    catalyst_timing: z.string().optional(),         // 催化剂时点
  })
  .passthrough();

export type TQintianjianForecast = z.infer<typeof ZQintianjianForecast>;
export type TForecastThreshold = z.infer<typeof ZForecastThreshold>;
