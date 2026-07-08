/**
 * 钦天监 · useForecastScenarios
 *
 * 默认从 /api/qintian/scenarios 读取(种子/Turso，诚实标 source)。
 * generateLive() 调 /api/qintian/scenarios/generate 让 callLLM 基于主库真实朝政上下文
 * 现推演三情景(sourceLabel='LIVE')；大脑不可用返回 null(FALLBACK)，调用方落回种子并明示示意。
 * 不再硬编码 source='turso' 冒充真实(铁律13.2)。
 */

'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import type { QintianScenario, QintianScenariosApiResponse } from '@/lib/contracts/qintian';
import type { ForecastScenario } from '@/types/forecast';
import { withBasePath } from '@/lib/base-path';

const SCENARIOS_URL = withBasePath('/api/qintian/scenarios');
const GENERATE_URL = withBasePath('/api/qintian/scenarios/generate');

interface ScenariosBundle {
  scenarios: QintianScenario[];
  source: string;
}

async function scenariosFetcher(url: string): Promise<ScenariosBundle> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`scenarios fetch failed: ${res.status}`);
  const json = (await res.json()) as QintianScenariosApiResponse;
  if (!json.success) throw new Error(json.error ?? 'scenarios api error');
  // 诚实透传真实 meta.source(seed/turso)，不再硬编码 'turso'。
  return { scenarios: json.data, source: json.meta?.source ?? 'seed' };
}

export interface UseForecastScenariosResult {
  scenarios: QintianScenario[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
  /** 数据来源：live(LLM 实时推演) | turso | seed | fallback | mock */
  source: string;
  /** 是否正在实时推演 */
  isGenerating: boolean;
  /** 触发 callLLM 实时推演；成功返回真实情景(LIVE)，大脑不可用返回 null(FALLBACK)。 */
  generateLive: () => Promise<ForecastScenario[] | null>;
}

export function useForecastScenarios(): UseForecastScenariosResult {
  const { data, error, isLoading, mutate } = useSWR<ScenariosBundle>(
    SCENARIOS_URL,
    scenariosFetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 },
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [liveSource, setLiveSource] = useState<string | null>(null);

  const generateLive = useCallback(async (): Promise<ForecastScenario[] | null> => {
    setIsGenerating(true);
    try {
      const res = await fetch(GENERATE_URL, { method: 'POST' });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        success?: boolean;
        sourceLabel?: string;
        data?: ForecastScenario[];
      };
      if (json.success && json.sourceLabel === 'LIVE' && Array.isArray(json.data) && json.data.length > 0) {
        setLiveSource('live');
        void mutate();
        return json.data;
      }
      return null; // FALLBACK：大脑不可用，不伪造
    } catch {
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [mutate]);

  return {
    scenarios: data?.scenarios ?? [],
    isLoading,
    error: error instanceof Error ? error : null,
    mutate: () => { void mutate(); },
    source: liveSource ?? data?.source ?? 'mock',
    isGenerating,
    generateLive,
  };
}

/**
 * 从 scenarios 数组派生基准情景置信度（base scenario 的 confidence）。
 * 用于 AstronomerBottomDock 的 confidence prop。
 */
export function deriveConfidence(scenarios: QintianScenario[]): number | undefined {
  const base = scenarios.find((s) => s.name === 'base');
  return base ? Math.round(base.confidence * 100) : undefined;
}
