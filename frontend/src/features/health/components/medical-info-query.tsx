/**
 * 健康中心 · 医疗信息查询
 *
 * 一个知识查询面板，支持搜索医学术语、用药、指标含义等。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Sparkles, Shield, ExternalLink, Loader2 } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { MedicalInfoQueryResult } from '@/types/health';
import { streamSseTokens } from '@/lib/sse-tokens';

const SUGGESTIONS = [
  'LDL 连续偏高该怎么调整？',
  '收缩压偏高有哪些生活习惯建议？',
  'BMI 24.1 需要减重吗？',
  '每周 3 次深海鱼对血脂有帮助吗？',
];

export function MedicalInfoQuery() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MedicalInfoQueryResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleQuery = async (q?: string) => {
    const finalQuery = (q ?? query).trim();
    if (!finalQuery || loading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setQuery(finalQuery);
    setLoading(true);
    setResult(null);

    const base: Omit<MedicalInfoQueryResult, 'answer'> = {
      query: finalQuery,
      confidence: 0.85,
      sources: [],
      disclaimers: ['本回答仅供参考，不构成诊疗建议。'],
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: finalQuery }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error('upstream');

      setLoading(false);
      setResult({ ...base, answer: '▋' });

      let accumulated = '';
      for await (const token of streamSseTokens(res.body)) {
        accumulated += token;
        setResult({ ...base, answer: accumulated + '▋' });
      }

      setResult({ ...base, answer: accumulated || '太医院已收到您的咨询。' });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setLoading(false);
      setResult({
        ...base,
        answer: '太医院暂时无法回应，请稍后再试。',
        confidence: 0,
        disclaimers: ['连接失败，当前无法提供服务。'],
      });
    }
  };

  return (
    <GlassPanel tone="elevated" padding="md" hudCorners>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={13} className="text-[#F0C66A]" />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
            Medical Info Query · 太医院问询
          </div>
          <h3 className="text-[13px] font-bold text-[#EAEEFB]">医疗信息查询</h3>
        </div>
      </div>

      {/* 输入框 */}
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2"
        style={{
          borderColor: 'rgba(240, 198, 106, 0.3)',
          backgroundColor: 'rgba(4, 6, 14, 0.6)',
        }}
      >
        <Search size={13} className="flex-shrink-0 text-[#F0C66A]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
          placeholder="陛下请问 · 例：LDL 偏高该怎么调整饮食？"
          className="flex-1 bg-transparent text-[12px] text-[#EAEEFB] outline-none placeholder:text-[#484F72]"
        />
        <button
          type="button"
          onClick={() => handleQuery()}
          disabled={!query.trim() || loading}
          className="rounded px-3 py-1 text-[11px] font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, #F0C66A, #D4A84B)',
            color: '#04060E',
          }}
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : '问询'}
        </button>
      </div>

      {/* 建议 */}
      {!result && (
        <div className="mt-3">
          <div className="mb-1.5 text-[9px] uppercase tracking-wider text-[#484F72]">
            建议问题
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleQuery(s)}
                className="rounded-full border px-2.5 py-1 text-[10px] text-[#9AA3C4] transition-colors hover:border-[#F0C66A] hover:text-[#F0C66A]"
                style={{ borderColor: 'rgba(26, 33, 66, 0.8)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 回答 */}
      {result && (
        <div
          className="mt-3 rounded-lg border p-4"
          style={{
            borderColor: 'rgba(240, 198, 106, 0.25)',
            backgroundColor: 'rgba(10, 14, 30, 0.5)',
          }}
        >
          {/* 置信度 */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={11} className="text-[#3DD68C]" />
              <span className="text-[9px] uppercase tracking-wider text-[#6A7299]">
                太医院回答
              </span>
            </div>
            <span
              className="font-mono text-[10px]"
              style={{ color: result.confidence >= 0.8 ? '#3DD68C' : '#F0C66A' }}
            >
              置信度 {Math.round(result.confidence * 100)}%
            </span>
          </div>

          {/* 正文 */}
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[#EAEEFB]">
            {result.answer}
          </p>

          {/* 来源 */}
          {result.sources.length > 0 && (
            <div className="mt-3 border-t pt-2" style={{ borderColor: 'rgba(26, 33, 66, 0.6)' }}>
              <div className="mb-1 text-[9px] uppercase tracking-wider text-[#6A7299]">
                循证来源
              </div>
              <div className="space-y-1">
                {result.sources.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-[#9AA3C4]">
                    <ExternalLink size={9} className="text-[#484F72]" />
                    <span>{s.title}</span>
                    {s.publishedAt && (
                      <span className="font-mono text-[9px] text-[#484F72]">
                        · {s.publishedAt}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 免责声明 */}
          {result.disclaimers.length > 0 && (
            <div
              className="mt-2 rounded px-2 py-1 text-[9px] italic"
              style={{
                backgroundColor: 'rgba(245, 165, 36, 0.08)',
                color: '#F5A524',
              }}
            >
              ⚠ {result.disclaimers.join(' · ')}
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  );
}
