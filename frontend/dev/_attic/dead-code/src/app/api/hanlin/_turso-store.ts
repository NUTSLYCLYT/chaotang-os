/**
 * 朝堂 OS · 翰林院 Turso 数据层
 *
 * 当 TURSO_DB_URL 环境变量可用时，读写 Turso；否则返回 null（让调用方 fallback 到文件系统存储）。
 *
 * 表结构：首次使用时自动 CREATE TABLE IF NOT EXISTS（幂等）。
 * 数据是 JSON blob 列：id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
 * 这样省去严格 schema migration，翰林院 MVP 阶段追求快速迭代。
 *
 * 升级路径：当数据量超过 10k 行时再切换到列式结构。
 */

import { getDb } from '@/lib/db/turso';
import { HANLIN_TABLES, type HanlinTableName } from '@/lib/contracts/hanlin';
import type {
  AiReview,
  Award,
  Contribution,
  Experiment,
  ExportOffering,
  ProductizedModule,
  Recommendation,
  RewardPeriod,
  ScoutedProject,
  UpgradeCandidate,
} from '@/features/hanlin/types';

// =========================================================================
// 是否可用
// =========================================================================

export function isTursoAvailable(): boolean {
  return typeof process.env.TURSO_DB_URL === 'string' && process.env.TURSO_DB_URL.length > 0;
}

// =========================================================================
// 通用 CRUD helpers（JSON blob 模式）
// =========================================================================

async function ensureTable(table: HanlinTableName): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT NOT NULL PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

async function listRows<T>(table: HanlinTableName): Promise<T[]> {
  await ensureTable(table);
  const db = getDb();
  const result = await db.execute(`SELECT data FROM ${table} ORDER BY updated_at DESC`);
  return result.rows.map((row: Record<string, unknown>) => JSON.parse(row.data as string) as T);
}

async function getRow<T>(table: HanlinTableName, id: string): Promise<T | null> {
  await ensureTable(table);
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT data FROM ${table} WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return JSON.parse(result.rows[0]!.data as string) as T;
}

async function upsertRow<T extends { id: string }>(table: HanlinTableName, record: T): Promise<void> {
  await ensureTable(table);
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO ${table} (id, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: [record.id, JSON.stringify(record), now],
  });
}

async function upsertBatch<T extends { id: string }>(table: HanlinTableName, records: T[]): Promise<void> {
  await ensureTable(table);
  const db = getDb();
  const now = new Date().toISOString();
  // Batch upsert using transaction
  const stmts = records.map((r) => ({
    sql: `INSERT INTO ${table} (id, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: [r.id, JSON.stringify(r), now] as [string, string, string],
  }));
  await db.batch(stmts);
}

async function deleteAllRows(table: HanlinTableName): Promise<void> {
  await ensureTable(table);
  const db = getDb();
  await db.execute(`DELETE FROM ${table}`);
}

// =========================================================================
// 翰林院各实体 CRUD
// =========================================================================

// --- Contributions ---

export async function tursoListContributions(): Promise<Contribution[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    const rows = await listRows<Contribution>(HANLIN_TABLES.contributions);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return null;
  }
}

export async function tursoGetContribution(id: string): Promise<Contribution | null> {
  if (!isTursoAvailable()) return null;
  try {
    return await getRow<Contribution>(HANLIN_TABLES.contributions, id);
  } catch {
    return null;
  }
}

export async function tursoUpsertContribution(record: Contribution): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await upsertRow(HANLIN_TABLES.contributions, record);
    return true;
  } catch {
    return false;
  }
}

export async function tursoReplaceContributions(records: Contribution[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.contributions);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.contributions, records);
    return true;
  } catch {
    return false;
  }
}

// --- AI Reviews ---

export async function tursoListReviews(): Promise<AiReview[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    return await listRows<AiReview>(HANLIN_TABLES.reviews);
  } catch {
    return null;
  }
}

export async function tursoGetReviewByContribution(contributionId: string): Promise<AiReview | null> {
  if (!isTursoAvailable()) return null;
  try {
    await ensureTable(HANLIN_TABLES.reviews);
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT data FROM ${HANLIN_TABLES.reviews} WHERE json_extract(data, '$.contributionId') = ?`,
      args: [contributionId],
    });
    if (result.rows.length === 0) return null;
    return JSON.parse(result.rows[0]!.data as string) as AiReview;
  } catch {
    return null;
  }
}

export async function tursoUpsertReview(record: AiReview): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await upsertRow(HANLIN_TABLES.reviews, record);
    return true;
  } catch {
    return false;
  }
}

export async function tursoReplaceReviews(records: AiReview[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.reviews);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.reviews, records);
    return true;
  } catch {
    return false;
  }
}

// --- Recommendations ---

export async function tursoListRecommendations(): Promise<Recommendation[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    const rows = await listRows<Recommendation>(HANLIN_TABLES.recommendations);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return null;
  }
}

export async function tursoUpsertRecommendation(record: Recommendation): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await upsertRow(HANLIN_TABLES.recommendations, record);
    return true;
  } catch {
    return false;
  }
}

export async function tursoReplaceRecommendations(records: Recommendation[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.recommendations);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.recommendations, records);
    return true;
  } catch {
    return false;
  }
}

// --- Experiments ---

export async function tursoListExperiments(): Promise<Experiment[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    return await listRows<Experiment>(HANLIN_TABLES.experiments);
  } catch {
    return null;
  }
}

export async function tursoUpsertExperiment(record: Experiment): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await upsertRow(HANLIN_TABLES.experiments, record);
    return true;
  } catch {
    return false;
  }
}

export async function tursoReplaceExperiments(records: Experiment[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.experiments);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.experiments, records);
    return true;
  } catch {
    return false;
  }
}

// --- Awards ---

export async function tursoListAwards(): Promise<Award[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    const rows = await listRows<Award>(HANLIN_TABLES.awards);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return null;
  }
}

export async function tursoUpsertAward(record: Award): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await upsertRow(HANLIN_TABLES.awards, record);
    return true;
  } catch {
    return false;
  }
}

export async function tursoReplaceAwards(records: Award[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.awards);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.awards, records);
    return true;
  } catch {
    return false;
  }
}

// --- Reward Periods ---

export async function tursoListRewardPeriods(): Promise<RewardPeriod[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    const rows = await listRows<RewardPeriod>(HANLIN_TABLES.rewardPeriods);
    return rows.sort((a, b) => b.startAt.localeCompare(a.startAt));
  } catch {
    return null;
  }
}

export async function tursoUpsertRewardPeriod(record: RewardPeriod): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await upsertRow(HANLIN_TABLES.rewardPeriods, record);
    return true;
  } catch {
    return false;
  }
}

export async function tursoReplaceRewardPeriods(records: RewardPeriod[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.rewardPeriods);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.rewardPeriods, records);
    return true;
  } catch {
    return false;
  }
}

// --- Scouted Projects ---

export async function tursoListScoutedProjects(): Promise<ScoutedProject[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    const rows = await listRows<ScoutedProject>(HANLIN_TABLES.scoutedProjects);
    return rows.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  } catch {
    return null;
  }
}

export async function tursoReplaceScoutedProjects(records: ScoutedProject[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.scoutedProjects);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.scoutedProjects, records);
    return true;
  } catch {
    return false;
  }
}

// --- Upgrade Candidates ---

export async function tursoListUpgradeCandidates(): Promise<UpgradeCandidate[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    return await listRows<UpgradeCandidate>(HANLIN_TABLES.upgradeCandidates);
  } catch {
    return null;
  }
}

export async function tursoUpsertUpgradeCandidate(record: UpgradeCandidate): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await upsertRow(HANLIN_TABLES.upgradeCandidates, record);
    return true;
  } catch {
    return false;
  }
}

export async function tursoReplaceUpgradeCandidates(records: UpgradeCandidate[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.upgradeCandidates);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.upgradeCandidates, records);
    return true;
  } catch {
    return false;
  }
}

// --- Productized Modules ---

export async function tursoListProductizedModules(): Promise<ProductizedModule[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    const rows = await listRows<ProductizedModule>(HANLIN_TABLES.productizedModules);
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return null;
  }
}

export async function tursoUpsertProductizedModule(record: ProductizedModule): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await upsertRow(HANLIN_TABLES.productizedModules, record);
    return true;
  } catch {
    return false;
  }
}

export async function tursoReplaceProductizedModules(records: ProductizedModule[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.productizedModules);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.productizedModules, records);
    return true;
  } catch {
    return false;
  }
}

// --- Export Offerings ---

export async function tursoListExportOfferings(): Promise<ExportOffering[] | null> {
  if (!isTursoAvailable()) return null;
  try {
    const rows = await listRows<ExportOffering>(HANLIN_TABLES.exportOfferings);
    return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch {
    return null;
  }
}

export async function tursoUpsertExportOffering(record: ExportOffering): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await upsertRow(HANLIN_TABLES.exportOfferings, record);
    return true;
  } catch {
    return false;
  }
}

export async function tursoReplaceExportOfferings(records: ExportOffering[]): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await deleteAllRows(HANLIN_TABLES.exportOfferings);
    if (records.length > 0) await upsertBatch(HANLIN_TABLES.exportOfferings, records);
    return true;
  } catch {
    return false;
  }
}

// =========================================================================
// 全量重置（demo reset 用）
// =========================================================================

export async function tursoResetAll(seed: {
  contributions: Contribution[];
  reviews: AiReview[];
  recommendations: Recommendation[];
  experiments: Experiment[];
  awards: Award[];
  rewardPeriods: RewardPeriod[];
  scoutedProjects: ScoutedProject[];
  upgradeCandidates: UpgradeCandidate[];
  productizedModules: ProductizedModule[];
  exportOfferings: ExportOffering[];
}): Promise<boolean> {
  if (!isTursoAvailable()) return false;
  try {
    await Promise.all([
      tursoReplaceContributions(seed.contributions),
      tursoReplaceReviews(seed.reviews),
      tursoReplaceRecommendations(seed.recommendations),
      tursoReplaceExperiments(seed.experiments),
      tursoReplaceAwards(seed.awards),
      tursoReplaceRewardPeriods(seed.rewardPeriods),
      tursoReplaceScoutedProjects(seed.scoutedProjects),
      tursoReplaceUpgradeCandidates(seed.upgradeCandidates),
      tursoReplaceProductizedModules(seed.productizedModules),
      tursoReplaceExportOfferings(seed.exportOfferings),
    ]);
    return true;
  } catch {
    return false;
  }
}
