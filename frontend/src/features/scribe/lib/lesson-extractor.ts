/**
 * 朝堂 OS · 史馆 · 高价值对象提取
 *
 * 输入：一道案的完整 events（v1.5 FSM 归档）
 * 输出：三类高价值对象
 *   - lessons[]    可复用教训（"类似情况下应...避免..."）
 *   - patterns[]   决策规律（"驳议集中在...环节"）
 *   - tags[]       语义分类（用于跨案召回）
 *
 * 设计：
 *   - 纯函数 · buildExtractionPrompt → 给 LLM Router 跑
 *   - parseExtraction 解析 LLM 返回 · 容错（JSON 外围允许有解释文字）
 *   - extractedLesson schema 版本化 · 后续演进不打破旧数据
 */

import type { Bill } from '@/features/governance/lib/bill-fsm';

export const LESSON_SCHEMA_VERSION = 1;

export interface ExtractedLesson {
  /** 向后兼容字段 · 有助于 reader 判断要不要重新 extract */
  schemaVersion: number;
  billId: string;
  billTitle: string;
  extractedAt: string;
  /** 教训列表 · 每条独立可引用 */
  lessons: Array<{
    id: string;
    text: string;
    /** 严重度 · critical / important / note */
    severity: 'critical' | 'important' | 'note';
  }>;
  /** 跨案规律 · 单条 · 偏抽象 */
  patterns: string[];
  /** 语义分类标签 · 5 个以内 · 便于反向检索 */
  tags: string[];
  /** 从哪些 event id 抽出的 · audit trail */
  sourceEventIds: string[];
  /** 总结一句话 · 给 UI 列表显示 */
  summary: string;
}

const EXTRACTION_SYSTEM_PROMPT = `你是朝堂史馆太史令。职责：从一道案的完整事件流中，抽出三类**可复用对象**，供后续相似情况召回。

输出严格 JSON（不要任何 markdown / 解释）：
{
  "summary": "<30 字一句话摘要>",
  "lessons": [{"text": "<20-60 字教训>", "severity": "critical|important|note"}],
  "patterns": ["<规律 1>", "<规律 2>"],
  "tags": ["<标签 1>", "<标签 2>", "..."]
}

规则：
- lessons 至少 1 条 · 至多 5 条 · 严重度 critical 仅用于重大损失/风险
- patterns 偏抽象 · 不复制 lesson · 例："驳议通常集中在证据力环节"
- tags 不超过 5 个 · 长度 ≤ 8 字 · 便于索引
- 严禁输出 markdown / code block / 解释`;

/**
 * 构造 LLM 提取 prompt
 */
export function buildExtractionPrompt(bill: Bill): { system: string; user: string } {
  const lines: string[] = [
    `【案标题】${bill.title}`,
    `【原始旨意】${bill.command}`,
    `【最终状态】${bill.state}`,
    `【修订次数】${bill.revisionCount}`,
    `【事件时间线 · ${bill.events.length} 帧】`,
  ];
  for (const e of bill.events) {
    lines.push(
      `  - ${e.ts.slice(11, 19)} · [${e.actor}] ${e.type} · ${e.reason}`,
    );
  }
  if (bill.menxiaReview) {
    lines.push(`【门下最终裁决】${bill.menxiaReview.verdict} · ${bill.menxiaReview.reasoning}`);
  }
  return {
    system: EXTRACTION_SYSTEM_PROMPT,
    user: lines.join('\n'),
  };
}

/**
 * 解析 LLM 输出 · 容错（允许 JSON 外围有解释文字）
 * 失败抛 Error · 上层可 fallback 到规则抽取
 */
export function parseExtraction(
  raw: string,
  bill: Bill,
): ExtractedLesson {
  // 找到第一个 { 和最后一个 } · 取中间
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('no JSON object in LLM output');
  }
  const jsonStr = raw.slice(start, end + 1);

  let parsed: {
    summary?: unknown;
    lessons?: unknown;
    patterns?: unknown;
    tags?: unknown;
  };
  try {
    parsed = JSON.parse(jsonStr) as typeof parsed;
  } catch (err) {
    throw new Error(
      `JSON parse failed · ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  // 容错转换 · 字段缺 / 类型错都按默认
  const lessonsRaw = Array.isArray(parsed.lessons) ? parsed.lessons : [];
  const lessons = lessonsRaw
    .map((l: unknown, i: number) => {
      if (!l || typeof l !== 'object') return null;
      const obj = l as Record<string, unknown>;
      const text = typeof obj.text === 'string' ? obj.text.trim() : '';
      if (text.length < 4) return null;
      const sev = obj.severity as string;
      const severity: ExtractedLesson['lessons'][number]['severity'] =
        sev === 'critical' || sev === 'note' ? sev : 'important';
      return {
        id: `${bill.id}_l${i}`,
        text: text.slice(0, 200),
        severity,
      };
    })
    .filter((x): x is ExtractedLesson['lessons'][number] => x !== null)
    .slice(0, 5);

  if (lessons.length === 0) {
    // 兜底：从 events 抽一条规则 lesson
    lessons.push({
      id: `${bill.id}_l0`,
      text: `${bill.state === 'completed' ? '本案成' : '本案' + bill.state} · 共 ${bill.events.length} 帧 · 修订 ${bill.revisionCount} 次`,
      severity: 'note',
    });
  }

  const patterns = (Array.isArray(parsed.patterns) ? parsed.patterns : [])
    .map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
    .filter((s: string) => s.length > 2)
    .slice(0, 3);

  const tags = (Array.isArray(parsed.tags) ? parsed.tags : [])
    .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
    .filter((s: string) => s.length > 0 && s.length <= 12)
    .slice(0, 5);

  const summary =
    typeof parsed.summary === 'string'
      ? parsed.summary.trim().slice(0, 80)
      : `${bill.title} · ${bill.state}`;

  return {
    schemaVersion: LESSON_SCHEMA_VERSION,
    billId: bill.id,
    billTitle: bill.title,
    extractedAt: new Date().toISOString(),
    lessons,
    patterns,
    tags,
    sourceEventIds: bill.events.map((e) => e.id),
    summary,
  };
}

/**
 * 规则兜底抽取 · 当 LLM 全挂时用
 * 不依赖 LLM · 仅能抽出平庸但有效的 lessons
 */
export function ruleBasedExtract(bill: Bill): ExtractedLesson {
  const lessons: ExtractedLesson['lessons'] = [];

  // 修订多 → critical lesson
  if (bill.revisionCount >= 2) {
    lessons.push({
      id: `${bill.id}_l0`,
      text: `本案修订 ${bill.revisionCount} 次 · 首版起草质量需提升 · 门下驳议焦点应前置到中书起草时自审`,
      severity: 'important',
    });
  }

  // 被门下驳过 → note
  const rejectedCount = bill.events.filter((e) => e.type === 'reject_for_revision').length;
  if (rejectedCount > 0) {
    lessons.push({
      id: `${bill.id}_l${lessons.length}`,
      text: `门下省驳回 ${rejectedCount} 次 · 类似案起草时应预先咨询祖训`,
      severity: 'note',
    });
  }

  // 失败 → critical
  if (bill.state === 'failed') {
    lessons.push({
      id: `${bill.id}_l${lessons.length}`,
      text: `本案执行失败 · 尚书派出后六部未能落地 · 需复盘 blast radius 估算是否过低`,
      severity: 'critical',
    });
  }

  if (lessons.length === 0) {
    lessons.push({
      id: `${bill.id}_l0`,
      text: `${bill.title} · ${bill.state} · 共 ${bill.events.length} 帧 · 流程顺畅`,
      severity: 'note',
    });
  }

  return {
    schemaVersion: LESSON_SCHEMA_VERSION,
    billId: bill.id,
    billTitle: bill.title,
    extractedAt: new Date().toISOString(),
    lessons,
    patterns:
      bill.revisionCount >= 2
        ? ['首版起草质量与门下驳议次数正相关 · 需前置 constitutional 预审']
        : [],
    tags: [bill.state, bill.revisionCount > 0 ? '有修订' : '一次过'],
    sourceEventIds: bill.events.map((e) => e.id),
    summary: `${bill.title} · ${bill.state} · ${lessons.length} 条教训`,
  };
}

/**
 * 简单文本 → 候选 tag 召回（用于跨案检索）
 * 返回按 tag 匹配数排序的 lesson · topK
 */
export function recallLessonsByText(
  query: string,
  lessons: ExtractedLesson[],
  topK = 5,
): ExtractedLesson[] {
  const q = query.toLowerCase();
  if (q.length < 2) return lessons.slice(0, topK);

  const scored = lessons.map((l) => {
    let score = 0;
    // tag 匹配 · 权重最高
    for (const t of l.tags) {
      if (q.includes(t.toLowerCase())) score += 3;
    }
    // summary 匹配
    if (l.summary.toLowerCase().includes(q)) score += 2;
    // lesson 文本匹配
    for (const ll of l.lessons) {
      if (ll.text.toLowerCase().includes(q)) score += 1;
    }
    return { lesson: l, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.lesson);
}
