import { z } from 'zod';

const windowSchema = z.object({
  kind: z.literal('ALL_RECORDED'),
  start_at: z.string().datetime({ offset: true }).nullable(),
  end_at: z.string().datetime({ offset: true }).nullable(),
});

const yushiMetricSchema = z
  .object({
    key: z.literal('yushi_rejection_rate'),
    label: z.string().min(1),
    status: z.enum(['LIVE', 'NO_DATA']),
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
    if (metric.status === 'LIVE' && (metric.value === null || metric.sample_size < 1)) {
      context.addIssue({
        code: 'custom',
        message: 'LIVE requires a value and at least one sample',
      });
    }
    if (metric.status === 'NO_DATA' && metric.value !== null) {
      context.addIssue({
        code: 'custom',
        message: 'NO_DATA must not contain a numeric value',
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
  status: 'LIVE' | 'NO_DATA';
  value: number | null;
  sampleSize: number;
  reason: string | null;
  dataSource: string;
  verdictSource: string | null;
  basis: string | null;
  window: {
    kind: 'ALL_RECORDED';
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
