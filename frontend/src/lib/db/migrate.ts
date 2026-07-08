import type { Client } from "@libsql/client";
import { ALL_DDL_STATEMENTS, TABLE_METADATA, TENANT_INDEX_STATEMENTS } from "./schema.ts";
import { logger } from "../logger.ts";

/**
 * Migration response interface
 */
export interface MigrationResult {
  ok: boolean;
  tables: string[];
  error?: string;
  timestamp?: string;
}

/**
 * Initializes database schema by executing all DDL statements
 * Creates tables if they don't exist (idempotent operation)
 * 
 * @param db - Turso/libSQL client instance
 * @returns Result object with status and list of created/verified tables
 * @throws Error with details if migration fails
 */
export async function initSchema(db: Client): Promise<MigrationResult> {
  const timestamp = new Date().toISOString();
  const createdTables: string[] = [];

  try {
    // SWARM-RUN-03 / DATA-FK-01 minimal hardening: enable foreign-key enforcement
    // on the migration connection before running DDL. SQLite/libSQL keep FK checks
    // OFF by default, so referential constraints declared in the schema would never
    // be enforced otherwise.
    //
    // LIMITATION: PRAGMA foreign_keys is *per-connection* in libSQL/Turso. The
    // singleton getDb() reuses one connection, but other route handlers may open
    // their own connections that are NOT guaranteed to have FK enabled. Therefore
    // this only guarantees FK integrity for operations performed over the migration
    // connection. The real defense against orphaned rows remains the explicit
    // SELECT-task validation at the agents/run entry point (handled in run/route.ts),
    // not this PRAGMA. Backward compatible: only turns on constraint checking;
    // existing valid data is unaffected.
    await db.execute("PRAGMA foreign_keys = ON");

    // Execute each DDL statement in order
    for (const ddl of ALL_DDL_STATEMENTS) {
      await db.execute(ddl);
    }

    // Add new columns if they don't exist (migration for existing tables).
    // Tenant columns are nullable on purpose: legacy rows remain visible only
    // through explicit legacy-compatible readers; new writes must set tenant_id.
    const newColumnsToAdd = [
      { table: 'tasks', column: 'tenant_id', type: 'TEXT' },
      { table: 'lessons', column: 'tenant_id', type: 'TEXT' },
      { table: 'intel_signals', column: 'tenant_id', type: 'TEXT' },
      { table: 'decisions', column: 'tenant_id', type: 'TEXT' },
      { table: 'forecast_scenarios', column: 'tenant_id', type: 'TEXT' },
      { table: 'manor_metrics', column: 'tenant_id', type: 'TEXT' },
      { table: 'hubu_projects', column: 'tenant_id', type: 'TEXT' },
      { table: 'hubu_summary', column: 'tenant_id', type: 'TEXT' },
      { table: 'health_profiles', column: 'tenant_id', type: 'TEXT' },
      { table: 'medical_news', column: 'tenant_id', type: 'TEXT' },
      { table: 'bingbu_competitors', column: 'tenant_id', type: 'TEXT' },
      { table: 'bingbu_swot', column: 'tenant_id', type: 'TEXT' },
      { table: 'bingbu_recommendations', column: 'tenant_id', type: 'TEXT' },
      { table: 'agent_runs', column: 'tenant_id', type: 'TEXT' },
      { table: 'agent_runs', column: 'intent', type: "TEXT DEFAULT 'other'" },
      { table: 'agent_runs', column: 'user_intent_raw', type: 'TEXT' },
      { table: 'agent_runs', column: 'swarm_id', type: 'TEXT' },
      { table: 'agent_runs', column: 'route_type', type: 'TEXT' },
      { table: 'agent_runs', column: 'user_id', type: 'TEXT' },
      { table: 'agent_runs', column: 'created_at', type: 'TEXT' },
      { table: 'emperor_decisions', column: 'source_label', type: "TEXT NOT NULL DEFAULT 'MIXED'" },
      { table: 'court_loop_runs', column: 'source_label', type: "TEXT NOT NULL DEFAULT 'MIXED'" }
    ] as const;

    const columnsByTable = new Map<string, Set<string>>();
    async function getColumns(table: string): Promise<Set<string>> {
      const cached = columnsByTable.get(table);
      if (cached) return cached;
      const info = await db.execute(`PRAGMA table_info(${table})`);
      const existing = new Set(
        info.rows.map((r) => (r['name'] ?? r[1]) as string)
      );
      columnsByTable.set(table, existing);
      return existing;
    }

    for (const { table, column, type } of newColumnsToAdd) {
      const existing = await getColumns(table);
      if (!existing.has(column)) {
        try {
          await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
          existing.add(column);
        } catch (alterError) {
          // Tolerate a concurrent "duplicate column" race; surface any other
          // failure so the migration result reports ok: false.
          const msg =
            alterError instanceof Error
              ? alterError.message
              : String(alterError);
          if (!/duplicate column/i.test(msg)) {
            throw alterError;
          }
          logger.warn('Column already present, skipping ALTER', { table, column });
        }
      }
    }

    // Existing databases may still carry the old non-tenant unique constraint
    // on manor_metrics(ministry_key, metric_label). Remove the index only; data
    // is untouched, and the tenant-scoped replacement is created below.
    await db.execute("DROP INDEX IF EXISTS manor_metrics_ministry_label");

    for (const ddl of TENANT_INDEX_STATEMENTS) {
      await db.execute(ddl);
    }

    // 清理 legacy 污染(2026-06-20 C1 旧账):部门学习记录曾被误经 upsertPrimaryTask
    // 写进主库 tasks,被 briefing「今日已办」/「最新20奏折」与史馆当奏折读出(污染朝报)。
    // 学习记录现归独立 department_learning 表,tasks 里这些 department_learning_% 行已无人读、纯污染。
    // 非阻塞(会审 Q4):清理失败只记录,不能阻断 tasks/decisions 等核心表可用性,下次启动重试。
    try {
      await cleanupLegacyLearningPollution(db);
    } catch (cleanupErr) {
      logger.error('legacy 学习污染清理失败(非阻塞,下次启动重试)', {
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    }

    // Verify all tables exist by querying the schema
    const tablesResult = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    if (tablesResult.rows) {
      for (const row of tablesResult.rows) {
        const tableName = row[0] as string;
        createdTables.push(tableName);
      }
    }

    return {
      ok: true,
      tables: createdTables,
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      tables: createdTables,
      error: errorMessage,
      timestamp,
    };
  }
}

/**
 * 幂等 legacy 清理(每次进程启动跑一次,再跑删 0 行):删除曾被误写进主库 tasks 的部门学习记录(id 前缀 department_learning_)。
 * 这些行污染 briefing/史馆/今日完成 KPI(均不按 id 过滤读 tasks)。学习记录现归独立
 * department_learning 表;tasks 里的前缀行无人读、纯污染。清完幂等(再跑删 0 行)。
 * 见 CLAUDE.md 铁律2(数据漂移)、`scripts/learning-fake-data-monitor.sh`。
 */
export async function cleanupLegacyLearningPollution(db: Client): Promise<number> {
  const res = await db.execute("DELETE FROM tasks WHERE id LIKE 'department_learning_%'");
  const removed = Number(res.rowsAffected ?? 0);
  if (removed > 0) {
    logger.warn('清理 legacy 部门学习污染(tasks → 已迁至独立表)', { removed });
  }
  return removed;
}

/**
 * Utility: Get list of all expected table names
 * Useful for validation and status checks
 * 
 * @returns Array of table names defined in schema
 */
export function getExpectedTableNames(): string[] {
  return TABLE_METADATA.map((meta) => meta.name);
}

/**
 * Utility: Verify that all required tables exist
 * 
 * @param db - Turso/libSQL client instance
 * @returns boolean indicating whether all tables exist
 */
export async function verifySchema(db: Client): Promise<boolean> {
  try {
    const expectedTables = getExpectedTableNames();
    const result = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    if (!result.rows) {
      return false;
    }

    const existingTables = result.rows.map((row) => row[0] as string);
    return expectedTables.every((table) => existingTables.includes(table));
  } catch {
    return false;
  }
}

/**
 * Utility: Get table record counts
 * Useful for monitoring and debugging
 * 
 * @param db - Turso/libSQL client instance
 * @returns Object mapping table names to record counts
 */
export async function getTableStats(
  db: Client
): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  try {
    const expectedTables = getExpectedTableNames();
    for (const table of expectedTables) {
      const result = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = (result.rows?.[0]?.[0] as number) || 0;
    }
  } catch (error) {
    console.error("Error fetching table stats:", error);
  }

  return stats;
}
