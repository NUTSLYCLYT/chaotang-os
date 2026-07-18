import { z } from 'zod';

const windowSchema = z.object({
  // ALL_RECORDED：NO_DATA/STALE/INSUFFICIENT_SAMPLE 描述全时段已记录历史边界；
  // ROLLING_7D：LIVE 只用近 7 天窗口计算，metadata 与之自洽（不再误标全时段）。
  kind: z.enum(['ALL_RECORDED', 'ROLLING_7D']),
  start_at: z.string().datetime({ offset: true }).nullable(),
  end_at: z.string().datetime({ offset: true }).nullable(),
});

// 与后端 _MIN_SAMPLE 一致:LIVE 必须是近 7 天窗口内足量样本。前端契约边界也 fail-closed,
// 挡住任何来源(后端回归/旧缓存/坏响应/中间人)送来的"薄样本 LIVE"或"全时段标 LIVE"误导。
const MIN_LIVE_SAMPLE = 20;

const yushiMetricSchema = z
  .object({
    key: z.literal('yushi_rejection_rate'),
    label: z.string().min(1),
    status: z.enum(['LIVE', 'NO_DATA', 'INSUFFICIENT_SAMPLE', 'STALE']),
    value: z.number().min(0).max(1).nullable(),
    sample_size: z.number().int().min(0),
    reason: z.string().min(1).nullable().optional(),
    data_source: z.string().min(1),
    verdict_source: z.string().min(1).optional(),
    basis: z.string().min(1).optional(),
    window: windowSchema,
    as_of: z.string().datetime({ offset: true }),
    includes_demo: z.boolean(),
  })
  .superRefine((metric, context) => {
    if (metric.status === 'LIVE') {
      // fail-closed:LIVE 必须带 value + 近窗足量样本(>=MIN_LIVE_SAMPLE)。挡薄样本 LIVE。
      if (metric.value === null || metric.sample_size < MIN_LIVE_SAMPLE) {
        context.addIssue({
          code: 'custom',
          message: `LIVE requires a value and >= ${MIN_LIVE_SAMPLE} windowed samples`,
        });
      }
      // LIVE 的比率只用近 7 天窗口算 → window 必须 ROLLING_7D。若标 ALL_RECORDED,
      // 说明是全时段比率却冒充 LIVE(误导 + 与后端诚实窗口化矛盾),拒之。
      if (metric.window.kind !== 'ROLLING_7D') {
        context.addIssue({
          code: 'custom',
          message: 'LIVE must report a ROLLING_7D window; an all-time rate cannot be labeled LIVE',
        });
      } else if (metric.window.start_at === null || metric.window.end_at === null) {
        // fail-closed:ROLLING_7D 但边界为空 = 空窗口,LIVE 不能宣称一个不存在的窗口。
        context.addIssue({
          code: 'custom',
          message: 'LIVE ROLLING_7D window must have non-null start_at and end_at (no empty window)',
        });
      } else {
        const startMs = new Date(metric.window.start_at).getTime();
        const endMs = new Date(metric.window.end_at).getTime();
        const asOfMs = new Date(metric.as_of).getTime();
        const spanDays = (endMs - startMs) / 86_400_000;
        const FIVE_MIN = 5 * 60_000;
        // ① 跨度必须 ~7 天(挡 10 小时/全时段冒充 ROLLING_7D)
        if (!(spanDays >= 6.5 && spanDays <= 7.5)) {
          context.addIssue({
            code: 'custom',
            message: `LIVE ROLLING_7D window span must be ~7 days, got ${spanDays.toFixed(2)}`,
          });
        } else if (Math.abs(endMs - asOfMs) > FIVE_MIN) {
          // ② 滚动窗必须"结束在计算时刻(as_of)"。end 不贴 as_of = 一个陈旧/未来的孤立
          //    7 日窗被贴了 LIVE(仅校验跨度会漏掉这类),拒之。
          context.addIssue({
            code: 'custom',
            message: 'LIVE ROLLING_7D window must end at as_of; a stale/future 7-day window is not a current rolling window',
          });
        } else {
          // ③ 新鲜度:as_of 必须接近当前时刻。太旧(>24h,陈旧缓存/重放)或在未来 →
          //    不是"当前"健康指标,拒渲染为 LIVE。宽容 5min 未来偏移 + 24h 陈旧上限以容缓存/时钟偏移。
          const ageMs = Date.now() - asOfMs;
          if (ageMs > 24 * 60 * 60_000 || ageMs < -FIVE_MIN) {
            context.addIssue({
              code: 'custom',
              message: 'LIVE as_of is stale (>24h old) or in the future; a rolling-7d LIVE must be freshly computed',
            });
          }
        }
      }
    }
    // 非 LIVE(NO_DATA/INSUFFICIENT_SAMPLE/STALE)一律不得带数值——绝不用比率
    // 冒充"当前健康",与后端诚实窗口化一致。
    if (metric.status !== 'LIVE' && metric.value !== null) {
      context.addIssue({
        code: 'custom',
        message: `${metric.status} must not contain a numeric value`,
      });
    }
  });

const guoliEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    metrics: z.array(z.unknown()),
  }),
  error: z.null().optional(),
});

export interface YushiRejectionMetric {
  key: 'yushi_rejection_rate';
  label: string;
  status: 'LIVE' | 'NO_DATA' | 'INSUFFICIENT_SAMPLE' | 'STALE';
  value: number | null;
  sampleSize: number;
  reason: string | null;
  dataSource: string;
  verdictSource: string | null;
  basis: string | null;
  window: {
    kind: 'ALL_RECORDED' | 'ROLLING_7D';
    startAt: string | null;
    endAt: string | null;
  };
  asOf: string;
  includesDemo: boolean;
}

export function parseYushiRejectionMetric(input: unknown): YushiRejectionMetric {
  const envelope = guoliEnvelopeSchema.parse(input);
  const rawMetric = envelope.data.metrics.find(
    (metric) =>
      typeof metric === 'object' &&
      metric !== null &&
      'key' in metric &&
      metric.key === 'yushi_rejection_rate',
  );
  const metric = yushiMetricSchema.parse(rawMetric);

  return {
    key: metric.key,
    label: metric.label,
    status: metric.status,
    value: metric.value,
    sampleSize: metric.sample_size,
    reason: metric.reason ?? null,
    dataSource: metric.data_source,
    verdictSource: metric.verdict_source ?? null,
    basis: metric.basis ?? null,
    window: {
      kind: metric.window.kind,
      startAt: metric.window.start_at,
      endAt: metric.window.end_at,
    },
    asOf: metric.as_of,
    includesDemo: metric.includes_demo,
  };
}

export function formatYushiRejectionValue(metric: YushiRejectionMetric): string | null {
  if (metric.status !== 'LIVE' || metric.value === null) return null;
  return `${(metric.value * 100).toFixed(1)}%`;
}

export function isGuoliThinSliceEnabled(
  raw = process.env.NEXT_PUBLIC_GUOLI_THIN_SLICE,
): boolean {
  if (raw === undefined) return true;
  return ['1', 'true', 'on', 'enabled'].includes(raw.trim().toLowerCase());
}
