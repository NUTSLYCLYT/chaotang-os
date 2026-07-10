'use client';

/**
 * 史馆 · useSWR hooks
 *
 * 替换所有 mock 数据调用，数据来源：
 *   /api/court/shiguan/stats   — ArchiveStats（Turso 聚合）
 *   /api/court/shiguan/archive — ArchiveRecord[]（Turso 查询）
 *   /api/court/shiguan/analyze — ShiguanAnalysis（LLM + COURT_TOOLS）
 */

import useSWR from 'swr';
import { useState, useCallback } from 'react';
import type { ArchiveStats, ArchiveRecord, ArchivePayload, ShiguanAnalysis } from '@/lib/contracts/archive';
import { backendFetch } from '@/lib/backend-api';
import { normalizeArchiveResponse } from './archive-adapter';

async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await backendFetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** 史馆统计数据（totalTasks / totalCases / successRate） */
export function useArchiveStats() {
  return useSWR<ArchiveStats>(
    '/api/court/shiguan/stats',
    jsonFetcher<ArchiveStats>,
    { refreshInterval: 60_000 },
  );
}

/** 史馆档案列表（Turso tasks + decisions 聚合） */
export function useArchiveRecords(limit = 50) {
  return useSWR<ArchivePayload>(
    `/api/chaotang/archive?limit=${limit}`,
    async (url: string) => normalizeArchiveResponse(await jsonFetcher<unknown>(url)),
    { refreshInterval: 120_000 },
  );
}

/** 命令类型频率（从 ArchiveRecord 列表计算，无需独立接口） */
export function useCommandTypeFreq(records: ArchiveRecord[]) {
  const freq: Record<string, number> = {};
  for (const r of records) {
    freq[r.type] = (freq[r.type] ?? 0) + 1;
  }
  const total = records.length || 1;
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }));
}

/** 部门成功率（从 ArchiveRecord 列表计算） */
export function useDeptSuccessRates(records: ArchiveRecord[]) {
  const deptMap: Record<string, { total: number; success: number }> = {};
  for (const r of records) {
    if (!deptMap[r.department]) deptMap[r.department] = { total: 0, success: 0 };
    deptMap[r.department].total++;
    if (r.outcome === 'success') deptMap[r.department].success++;
  }
  return Object.entries(deptMap)
    .map(([dept, s]) => ({
      dept,
      total: s.total,
      success: s.success,
      rate: Math.round((s.success / s.total) * 100),
    }))
    .sort((a, b) => b.rate - a.rate);
}

/** LLM 分析（手动触发，支持引用） */
export function useShiguanAnalysis() {
  const [analysis, setAnalysis] = useState<ShiguanAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await backendFetch('/api/court/shiguan/analyze', { method: 'POST' });
      if (!res.ok) throw new Error(`analyze → ${res.status}`);
      const data = (await res.json()) as ShiguanAnalysis;
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing]);

  return { analysis, analyzing, error, generate };
}
