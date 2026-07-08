/**
 * 朝堂 OS · RAG · 情报上下文
 *
 * fetchIntelContext() 调 Tavily Search API 获取实时网络情报
 * 抽取 citations（标题 / URL / 摘要 / 域名 / 相关度）
 * 返回结构化的 IntelContext 供锦衣卫 / 史馆 / 晨报流水线使用
 *
 * 环境变量：
 *   TAVILY_API_KEY  - 必须（Tavily 账号 key）
 *   TAVILY_MAX_RESULTS - 可选，默认 5，最大 10
 */

import type { Citation } from './citation';

export interface IntelContext {
  query: string;
  answer?: string;
  citations: Citation[];
  fetchedAt: string;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  score?: number;
}

interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
}

const TAVILY_API = 'https://api.tavily.com/search';

/**
 * 调 Tavily 搜索 API，返回结构化情报 + citations
 *
 * @param query      - 搜索查询词（中英文均可）
 * @param maxResults - 最多返回结果数，默认 5，最大 10
 * @param searchDepth - 'basic'（快）| 'advanced'（深度，计费更高）
 * @throws Error 当 TAVILY_API_KEY 缺失或请求失败时
 */
export async function fetchIntelContext(
  query: string,
  maxResults?: number,
  searchDepth: 'basic' | 'advanced' = 'basic',
): Promise<IntelContext> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not set');

  const k = Math.min(
    maxResults ?? Number(process.env.TAVILY_MAX_RESULTS ?? '5'),
    10,
  );

  const res = await fetch(TAVILY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: k,
      search_depth: searchDepth,
      include_answer: true,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Tavily ${res.status} · ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as TavilyResponse;

  const citations: Citation[] = data.results.map((r, i) => {
    let domain: string | undefined;
    try {
      domain = new URL(r.url).hostname.replace(/^www\./, '');
    } catch {
      domain = undefined;
    }

    return {
      id: `tavily-${i}-${encodeURIComponent(r.url).slice(0, 40)}`,
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 300),
      publishedAt: r.published_date,
      domain,
      relevanceScore: r.score != null ? Math.min(r.score, 1) : undefined,
    };
  });

  return {
    query: data.query ?? query,
    answer: data.answer,
    citations,
    fetchedAt: new Date().toISOString(),
  };
}
