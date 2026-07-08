// src/core/courtos/department-flywheel/ledger.ts
import { getPrimaryDb } from '@/lib/db/primary-store';
import type { DeptId, RaisedLedgerEntry } from './types';

async function ensureTable(): Promise<void> {
  const db = await getPrimaryDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dept_flywheel_ledger (
      raised_task_id TEXT PRIMARY KEY,
      dept TEXT NOT NULL,
      source_task_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

export async function loadLedger(dept: DeptId, limit = 500): Promise<RaisedLedgerEntry[]> {
  await ensureTable();
  const db = await getPrimaryDb();
  const res = await db.execute({
    sql: `SELECT raised_task_id, dept, source_task_id, content_hash, created_at
          FROM dept_flywheel_ledger WHERE dept = ? ORDER BY created_at DESC LIMIT ?`,
    args: [dept, limit],
  });
  return res.rows.map((r) => ({
    raisedTaskId: String(r.raised_task_id), dept: String(r.dept) as DeptId,
    sourceTaskId: String(r.source_task_id), contentHash: String(r.content_hash), at: String(r.created_at),
  }));
}

export async function appendLedger(entry: RaisedLedgerEntry): Promise<void> {
  await ensureTable();
  const db = await getPrimaryDb();
  await db.execute({
    sql: `INSERT OR IGNORE INTO dept_flywheel_ledger
          (raised_task_id, dept, source_task_id, content_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [entry.raisedTaskId, entry.dept, entry.sourceTaskId, entry.contentHash, entry.at],
  });
}

/**
 * 精确去重查询：替代 loadLedger 的内存 LIMIT-500 窗口比对。
 * 防超量条目时老记录掉出窗口造成重复上报。
 */
export async function hasRaised(
  dept: DeptId,
  sourceTaskId: string,
  contentHash: string,
): Promise<boolean> {
  await ensureTable();
  const db = await getPrimaryDb();
  const res = await db.execute({
    sql: `SELECT 1 FROM dept_flywheel_ledger
          WHERE dept = ? AND source_task_id = ? AND content_hash = ? LIMIT 1`,
    args: [dept, sourceTaskId, contentHash],
  });
  return res.rows.length > 0;
}
