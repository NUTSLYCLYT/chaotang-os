/**
 * 锦衣卫信源历史可信度（2026-07-04）
 *
 * `credibilityWeight`（`src/core/courtos/primitives/credibility.ts`）原为吏部面试官/推荐人
 * 历史命中率设计，是通用的 judge/decisions/correct 结构。这里把"信源"当 judge、"历史被引用
 * 次数"当 decisions、"后来证实为真"当 correct，复用同一函数，不重写一套加权逻辑。
 *
 * 诚实边界：times_confirmed 的回填（后来证实为真才 +1）尚未接入任何写入路径——本仓当前没有
 * "情报事后核验"闭环。所以查询结果对新信源必然落在 unproven（样本不足·暂不加权），这是诚实
 * 现状，不是 bug。等有了事后核验闭环，往 times_confirmed 里加计数即可，函数不用改。
 */
import { ensurePrimaryDbReady } from '@/lib/db/primary-store';
import { credibilityWeight, type CredibilityScore } from '@/core/courtos/primitives/credibility';

interface TrackRow {
  source_name: string;
  times_cited: number;
  times_confirmed: number;
}

/** 批量查一组信源的历史可信度；没有历史记录的信源按 decisions=0 走 unproven 分支。 */
export async function getSourceCredibilityMap(sourceNames: string[]): Promise<Map<string, CredibilityScore>> {
  const unique = Array.from(new Set(sourceNames.map((s) => s.trim()).filter(Boolean)));
  const scores = new Map<string, CredibilityScore>();
  if (unique.length === 0) return scores;

  const db = await ensurePrimaryDbReady();
  const placeholders = unique.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT source_name, times_cited, times_confirmed FROM intel_source_track_record WHERE source_name IN (${placeholders})`,
    args: unique,
  });
  const rows = result.rows as unknown as TrackRow[];
  const bySource = new Map(rows.map((r) => [r.source_name, r]));

  for (const name of unique) {
    const row = bySource.get(name);
    scores.set(
      name,
      credibilityWeight({ judge: name, decisions: row?.times_cited ?? 0, correct: row?.times_confirmed ?? 0 }),
    );
  }
  return scores;
}

/** 单个信源的历史可信度；查不到记录视为 unproven（今天第一次出现）。 */
export async function getSourceCredibility(sourceName: string): Promise<CredibilityScore> {
  const map = await getSourceCredibilityMap([sourceName]);
  return map.get(sourceName) ?? credibilityWeight({ judge: sourceName, decisions: 0, correct: 0 });
}

/**
 * 记录这次情报引用了这些信源（times_cited + 1）。这是"真实使用产生真实积累"的起点——
 * 不编造历史，每次真实写入情报才让对应信源 times_cited 往前走一步。
 */
export async function recordSourceCitations(sourceNames: string[]): Promise<void> {
  const unique = Array.from(new Set(sourceNames.map((s) => s.trim()).filter(Boolean)));
  if (unique.length === 0) return;

  const db = await ensurePrimaryDbReady();
  const now = new Date().toISOString();
  for (const name of unique) {
    await db.execute({
      sql: `
        INSERT INTO intel_source_track_record (source_name, times_cited, times_confirmed, updated_at)
        VALUES (?, 1, 0, ?)
        ON CONFLICT(source_name) DO UPDATE SET
          times_cited = times_cited + 1,
          updated_at = excluded.updated_at
      `,
      args: [name, now],
    });
  }
}
