/**
 * 朝堂 OS · RAG · Citation 类型
 *
 * 统一的引用来源结构，供 intel-context 和前端消费
 */

export interface Citation {
  /** 来源唯一标识（URL 或内部 id） */
  id: string;
  /** 来源标题 */
  title: string;
  /** 来源 URL（外部网页）或 undefined（内部来源） */
  url?: string;
  /** 摘要片段 · 最多 300 字 */
  snippet: string;
  /** 发布时间（ISO 8601） · Tavily 提供时填入 */
  publishedAt?: string;
  /** 来源域名 · 用于显示 */
  domain?: string;
  /** 相关度分数 0–1（Tavily score 映射） */
  relevanceScore?: number;
}
