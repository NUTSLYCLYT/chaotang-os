import { backendJson } from '@/lib/backend-api';

import { parseYushiRejectionMetric, type YushiRejectionMetric } from '../lib/guoli-overview';

export const GUOLI_OVERVIEW_PATH = '/api/guoli/overview';

export async function fetchYushiRejectionMetric(): Promise<YushiRejectionMetric> {
  const payload = await backendJson<unknown>(GUOLI_OVERVIEW_PATH);
  return parseYushiRejectionMetric(payload);
}
