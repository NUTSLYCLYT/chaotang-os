/**
 * 朝堂 OS · 御书房 · Imperial Study
 * 陛下个人知识圣殿 · RAG索引层
 *
 * 设计原则：
 *   - 本地优先：用 IndexedDB 存元数据 + 文本内容，SQLite-WASM 跑向量检索
 *   - 上游降级：legal-agent /materials/upload 做服务端 OCR + 向量化
 *   - 零依赖：不引入 langchain/llamaindex 这类重框架，纯 TS 手写
 *
 * 数据模型：
 *   Scroll    一份上传的资料 · 可能是 PDF/URL/markdown/image
 *   Chunk     切分后的可检索片段 · 带 embedding
 *   Annotation 陛下对 scroll 的批注 · 可反向索引
 */

export type ScrollType = 'pdf' | 'url' | 'markdown' | 'image' | 'text';

/** 四部分类：经/史/子/集 · 中国古籍传统 */
export type ScrollCategory = '经' | '史' | '子' | '集' | '未分';

export interface Scroll {
  id: string;
  title: string;
  type: ScrollType;
  category: ScrollCategory;
  source?: string; // URL / filename
  /** 正文全文 · 可直接塞 prompt */
  body: string;
  /** 按 500 token 切分的 chunk */
  chunks: Chunk[];
  /** 陛下批注 */
  annotations: Annotation[];
  /** 元数据 */
  createdAt: string;
  tags: string[];
  wordCount: number;
  /** 上次被 AI 引用时间 · 用于"活跃度"排序 */
  lastCitedAt?: string;
}

export interface Chunk {
  id: string;
  scrollId: string;
  index: number;
  text: string;
  /** 384-dim embedding · 用 all-MiniLM-L6 等轻量模型 · 可暂时为空（降级为全文检索） */
  embedding?: Float32Array;
}

export interface Annotation {
  id: string;
  scrollId: string;
  chunkId?: string;
  text: string;
  createdAt: string;
}

/**
 * 检索接口 · 三层语义
 *   - full-text:  简单 includes · 兜底
 *   - semantic:   embedding cos-sim
 *   - hybrid:     BM25 * 0.3 + semantic * 0.7
 */
export interface LibuSearchResult {
  scroll: Scroll;
  chunk: Chunk;
  score: number;
  matchType: 'full-text' | 'semantic' | 'hybrid';
}

/**
 * 本地存储 · IndexedDB 驱动
 * 生产可替换为 sqlite-wasm + pgvector 格式
 */
const DB_NAME = 'courtos.libu';
const DB_VERSION = 1;

export async function openLibuDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('scrolls')) {
        const store = db.createObjectStore('scrolls', { keyPath: 'id' });
        store.createIndex('category', 'category');
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 切分 · 按段落优先，过长再按句号 */
export function chunkText(text: string, maxChars = 1500): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let buf = '';
  for (const p of paragraphs) {
    if (buf.length + p.length <= maxChars) {
      buf += (buf ? '\n\n' : '') + p;
    } else {
      if (buf) chunks.push(buf);
      if (p.length <= maxChars) {
        buf = p;
      } else {
        // 超长段落再按句号切
        const sentences = p.split(/(?<=[。！？\.\!\?])/);
        let s = '';
        for (const sent of sentences) {
          if (s.length + sent.length <= maxChars) s += sent;
          else {
            if (s) chunks.push(s);
            s = sent;
          }
        }
        buf = s;
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks.filter((c) => c.trim().length > 0);
}

/** 朴素全文检索 · 无 embedding 时兜底 */
export function fullTextSearch(
  scrolls: Scroll[],
  query: string,
  limit = 10,
): LibuSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: LibuSearchResult[] = [];
  for (const scroll of scrolls) {
    for (const chunk of scroll.chunks) {
      const text = chunk.text.toLowerCase();
      const idx = text.indexOf(q);
      if (idx >= 0) {
        // 简单打分：命中越靠前得分越高
        const score = 1 - idx / text.length;
        results.push({ scroll, chunk, score, matchType: 'full-text' });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * 余弦相似度 · 语义检索核心
 * embedding 从 BFF 拉（/api/libu/embed）或前端 transformers.js 本地跑
 */
export function cosineSim(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** 带时间衰减的语义检索 · 新 scroll 天然加分 */
export function semanticSearch(
  scrolls: Scroll[],
  queryEmbedding: Float32Array,
  now: number = Date.now(),
  halfLifeDays = 60,
  limit = 10,
): LibuSearchResult[] {
  const results: LibuSearchResult[] = [];
  for (const scroll of scrolls) {
    const ageDays = (now - new Date(scroll.createdAt).getTime()) / 86_400_000;
    const freshness = Math.pow(0.5, ageDays / halfLifeDays);
    for (const chunk of scroll.chunks) {
      if (!chunk.embedding) continue;
      const sim = cosineSim(queryEmbedding, chunk.embedding);
      const score = sim * 0.8 + freshness * 0.2;
      results.push({ scroll, chunk, score, matchType: 'semantic' });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * 脚注格式化 · 给 AI 回答加引文
 *   "根据《XX卷》第2段，合同条款..."
 */
export function formatCitation(scroll: Scroll, chunk: Chunk): string {
  return `《${scroll.title}》第${chunk.index + 1}段`;
}

/** 把检索结果塞给 LLM system prompt · 用于 RAG */
export function resultsToContext(results: LibuSearchResult[]): string {
  if (results.length === 0) return '';
  const lines = results.map((r, i) => {
    const cite = formatCitation(r.scroll, r.chunk);
    return `[${i + 1}] ${cite}\n${r.chunk.text.slice(0, 600)}`;
  });
  return `## 御书房 · 相关卷宗\n\n${lines.join('\n\n---\n\n')}\n\n## 引用规范\n回答时若引用以上内容，请在句末加 [数字] 脚注。`;
}
