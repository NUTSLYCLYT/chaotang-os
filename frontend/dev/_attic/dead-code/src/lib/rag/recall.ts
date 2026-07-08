/**
 * 朝堂 OS · RAG · 向量召回
 *
 * recallSimilar() 用 Turso vector_cosine_similarity 做 ANN 查询
 * 返回按相似度降序排列的候选行（相似度 < 1.0）
 *
 * 使用方式：
 *   const hits = await recallSimilar('lessons', queryVec, 5);
 *
 * Turso vector_cosine_similarity 语法（libSQL 向量扩展）：
 *   SELECT *, vector_cosine_similarity(embedding, vector32(?)) AS score
 *   FROM lessons
 *   WHERE embedding IS NOT NULL
 *   ORDER BY score DESC
 *   LIMIT ?
 *
 * 注意：
 * - embedding 列必须是 BLOB（Float32 little-endian）
 * - vector32() 函数接受 JSON 数组字符串 OR BLOB
 * - 余弦相似度范围 [-1, 1]，但语义向量通常 0.6-0.99
 * - 严格过滤 score < 1.0 防止完全相同向量的自匹配
 */

import { getDb } from '@/lib/db/turso';

export interface RecallHit {
  id: string;
  score: number;
  [key: string]: unknown;
}

/**
 * 在指定表的 embedding 列上做余弦相似度召回
 *
 * @param table     - 表名（须在 schema.ts 中已定义）
 * @param queryVec  - 查询向量（与存储维度必须一致）
 * @param topK      - 最多返回条数，默认 5，最大 20
 * @param maxScore  - 相似度上限（默认 < 1.0 防自匹配）
 * @param minScore  - 相似度下限（默认 0.0 过滤无关结果）
 * @returns 按 score 降序排列的结果行
 */
export async function recallSimilar(
  table: string,
  queryVec: Float32Array,
  topK = 5,
  maxScore = 0.9999,
  minScore = 0.0,
): Promise<RecallHit[]> {
  const k = Math.min(topK, 20);
  const db = getDb();

  // 将 Float32Array 转成 JSON 数组字符串供 vector32() 消费
  // Turso vector32() 接受 '[1.0, 2.0, ...]' 格式
  const vecJson = `[${Array.from(queryVec).join(',')}]`;

  const sql = `
    SELECT *, vector_cosine_similarity(embedding, vector32(?)) AS score
    FROM ${table}
    WHERE embedding IS NOT NULL
      AND vector_cosine_similarity(embedding, vector32(?)) < ?
      AND vector_cosine_similarity(embedding, vector32(?)) >= ?
    ORDER BY score DESC
    LIMIT ?
  `;

  const result = await db.execute({
    sql,
    args: [vecJson, vecJson, maxScore, vecJson, minScore, k],
  });

  return (result.rows ?? []).map((row: Record<string, unknown>) => {
    const hit: RecallHit = { id: String(row.id ?? ''), score: Number(row.score ?? 0) };
    for (const [key, val] of Object.entries(row)) {
      if (key !== 'id' && key !== 'score') {
        hit[key] = val;
      }
    }
    return hit;
  });
}

/**
 * 专门召回 lessons 表中的相似记录
 * 返回字段：id, task_id, content, tags, outcome, created_at, score
 */
export async function recallSimilarLessons(
  queryVec: Float32Array,
  topK = 5,
): Promise<Array<RecallHit & { task_id: string; content: string; tags: string | null; outcome: string }>> {
  const hits = await recallSimilar('lessons', queryVec, topK);
  return hits.map((h) => ({
    ...h,
    task_id: String(h.task_id ?? ''),
    content: String(h.content ?? ''),
    tags: h.tags != null ? String(h.tags) : null,
    outcome: String(h.outcome ?? ''),
  }));
}
