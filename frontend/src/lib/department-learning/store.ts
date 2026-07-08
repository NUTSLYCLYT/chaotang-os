/**
 * CourtOS · 部门 Agent 学习记录持久化(独立表)
 *
 * 铁律2 SSOT + Bezos 结构门:学习记录写**独立** `department_learning` 表,
 * 绝不进主库 `tasks`——否则会被 briefing/史馆/今日完成 KPI 等不按 id 过滤的查询
 * 当成奏折/已办任务读出,把数据漂移伪装成成功(2026-06-20 会审 C1)。
 * 单一 save/load/parse 在此,两个 learning route 一律 import,不各维护平行实现(铁律3)。
 */

import { ensurePrimaryDbReady } from '@/lib/db/primary-store';
import type { DepartmentLearningRecord } from '@/lib/contracts/department-learning';

let ensured = false;

async function table() {
  const db = await ensurePrimaryDbReady();
  if (!ensured) {
    await db.execute({
      sql: `
        CREATE TABLE IF NOT EXISTS department_learning (
          id TEXT PRIMARY KEY,
          record_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
      args: [],
    });
    ensured = true;
  }
  return db;
}

function parseRecord(raw: unknown): DepartmentLearningRecord | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as DepartmentLearningRecord;
  } catch {
    return null;
  }
}

export async function saveLearningRecord(record: DepartmentLearningRecord): Promise<void> {
  const db = await table();
  await db.execute({
    sql: `
      INSERT INTO department_learning (id, record_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        record_json = excluded.record_json,
        updated_at = excluded.updated_at
    `,
    args: [record.id, JSON.stringify(record), record.updatedAt],
  });
}

export async function loadLearningRecords(limit = 100): Promise<DepartmentLearningRecord[]> {
  const db = await table();
  const res = await db.execute({
    sql: `SELECT record_json FROM department_learning ORDER BY updated_at DESC LIMIT ?`,
    args: [limit],
  });
  return (res.rows as Array<Record<string, unknown>>)
    .map((row) => parseRecord(row.record_json))
    .filter((record): record is DepartmentLearningRecord => Boolean(record));
}
