/**
 * 朝堂 OS · 史馆 · Temporal Memory Palace
 *
 * Karpathy-style 长时记忆 · 三层索引：
 *   1. events    每次落印入库 · 带 {时间, 决策类型, 情绪标签, 涉及实体}
 *   2. cases     按 case 聚合 · outcome 归纳
 *   3. annals    每周 LLM 自动生成章回体纪传
 *
 * 与朴素向量库的区别：
 *   - Episodic（事件驱动）+ Semantic（主题）+ Temporal（衰减）三索引
 *   - Emotional weighting：带情绪标签的事件检索加权（像人类记忆）
 *   - Cross-case reasoning：相似案例自动抽象成新 lesson
 */

export interface MemoryEvent {
  id: string;
  timestamp: string;
  /** 事件类型 · 决策 / 执行 / 批示 / 异常 / 反馈 */
  type: 'decision' | 'execution' | 'verdict' | 'anomaly' | 'feedback';
  /** 原始 payload */
  payload: Record<string, unknown>;
  /** 如有，关联的 case id */
  caseId?: string;
  /** 情绪标签 · 用于按情感检索（像"那次我紧张的合同案"） */
  emotionalValence?: 'positive' | 'neutral' | 'negative' | 'critical';
  /** 涉及的实体 · 便于按人/事/物检索 */
  entities: string[];
  /** 自动生成的一句话摘要 · 200 字内 */
  summary: string;
  /** 向量化后的 embedding */
  embedding?: Float32Array;
}

export interface MemoryCase {
  id: string;
  title: string;
  openedAt: string;
  closedAt?: string;
  eventIds: string[];
  /** 最终结局摘要 */
  outcomeSummary?: string;
  /** LLM 抽取的 lesson */
  lessons: string[];
  /** case 级别 tag */
  tags: string[];
}

export interface AnnalChapter {
  id: string;
  /** 时间范围 · YYYY-MM-W（某月第 W 周）或 YYYY-MM */
  period: string;
  /** 章回体正文 · markdown */
  chapterMd: string;
  /** 本章涉及的 event ids */
  sourceEventIds: string[];
  /** 本章 3 个 key lessons */
  keyLessons: string[];
  generatedAt: string;
  /** 陛下是否已读 · 用于"新章提醒" */
  readByRuler: boolean;
}

/** 检索参数 */
export interface RecallQuery {
  /** 语义查询 */
  query?: string;
  /** 涉及的实体 · 精确匹配 */
  entities?: string[];
  /** 事件类型过滤 */
  types?: MemoryEvent['type'][];
  /** 时间窗 · 毫秒时间戳 */
  since?: number;
  until?: number;
  /** 是否加情绪权重 */
  emotionalBoost?: boolean;
  /** 返回条数 */
  k?: number;
}

/**
 * 核心：带时间衰减 + 情绪加权的 episodic 检索
 *
 * score = cos_sim(query_embedding, event_embedding)
 *       * exp(-age_days / 30)        // 30 天半衰
 *       * (1 + emotional_weight)     // negative/critical 加权
 */
export function recallEvents(
  events: MemoryEvent[],
  query: RecallQuery,
  queryEmbedding?: Float32Array,
): MemoryEvent[] {
  const now = Date.now();
  const scored = events
    .filter((e) => {
      if (query.since && new Date(e.timestamp).getTime() < query.since) return false;
      if (query.until && new Date(e.timestamp).getTime() > query.until) return false;
      if (query.types && !query.types.includes(e.type)) return false;
      if (query.entities && query.entities.length > 0) {
        if (!query.entities.some((ent) => e.entities.includes(ent))) return false;
      }
      return true;
    })
    .map((e) => {
      let sim = 0;
      if (queryEmbedding && e.embedding) sim = cosineSim(queryEmbedding, e.embedding);

      const ageDays = (now - new Date(e.timestamp).getTime()) / 86_400_000;
      const decay = Math.exp(-ageDays / 30);

      let emoWeight = 0;
      if (query.emotionalBoost) {
        emoWeight = {
          positive: 0.1,
          neutral: 0,
          negative: 0.3,
          critical: 0.5,
        }[e.emotionalValence ?? 'neutral'];
      }

      const score = sim * decay * (1 + emoWeight);
      return { event: e, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, query.k ?? 5).map((s) => s.event);
}

/**
 * Cross-case reasoning · 给定一组相似 cases，抽象出一条新 lesson
 *
 * 这是真正的"AI 长期记忆" · 不只是检索，还能 summarize 出规律
 */
export function abstractLessonPrompt(cases: MemoryCase[]): string {
  const summaries = cases.map(
    (c) => `【${c.title}】\n结局：${c.outcomeSummary ?? '尚未结案'}\n教训：${c.lessons.join('；')}`,
  );

  return `你是司马迁 · 史官。
以下是朝堂 ${cases.length} 份相似旧案，请从中归纳出一条**新的、更抽象的规律**（不超过 50 字）：

${summaries.join('\n\n')}

规律：`;
}

/**
 * 纪传体章回 · 每周一自动生成
 * 把本周所有 events 读入 → LLM 写成章回体
 */
export function annalsChapterPrompt(
  period: string,
  events: MemoryEvent[],
  priorChapters: AnnalChapter[] = [],
): string {
  const eventLines = events
    .slice(0, 50) // 防止超 prompt
    .map((e) => `${e.timestamp.slice(0, 10)} · [${e.type}] ${e.summary}`);

  const priorContext = priorChapters
    .slice(-2)
    .map((c) => `### ${c.period}\n${c.chapterMd.slice(0, 500)}`)
    .join('\n\n');

  return `你是司马迁 · 朝堂史馆总编撰。
体裁：章回体（"却说...且说...话说..."开头，"欲知后事如何，请听下回分解"结尾）
文风：太史公笔法 · 不失幽默 · 不虚美不隐恶

前情（最近 2 章，供文气连贯）：
${priorContext || '（尚无前章）'}

本章时段：${period}
本章素材（${events.length} 条事件）：
${eventLines.join('\n')}

请撰写本章「${period}章回」：
  - 800-1200 字
  - 开头一句话点题
  - 中间夹 2-3 个具体事件的细节描写
  - 结尾点出 1 个本期 key lesson
  - 全文 markdown 格式

章回正文：`;
}

/** 辅助 · cos sim */
function cosineSim(a: Float32Array, b: Float32Array): number {
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
