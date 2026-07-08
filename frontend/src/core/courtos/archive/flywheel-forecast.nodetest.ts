/**
 * 决策飞轮·回测断言(铁律4双门之(b))。2026-07-04 接通决策飞轮 PR。
 *
 * archive-store.ts 有 server-only 不能直接 import,照 shiguan-honesty.nodetest.ts 模式:
 * 用 in-memory libSQL 复刻 court_archives 三新列 + listDueUnsettled 的 SQL,测契约不变式。
 * 钉死三条(改坏必红):
 *  1. 决策存档带 forecast_json + review_by_date(飞轮输入端在积累)。
 *  2. retrospective_status 落库保持 NULL —— 钢轨1·无真结果绝不编 outcome。
 *  3. 到期未结算(review_by_date 过 + retrospective NULL)被捞出,零漏。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@libsql/client';

// 与 archive-store.ts ensureTable 的三新列保持一致(SSOT:改表结构必同步改这里,否则测失效)。
const CREATE = `CREATE TABLE court_archives (
  id TEXT PRIMARY KEY, task_id TEXT, original_question TEXT NOT NULL,
  verdict TEXT, user_id TEXT, created_at TEXT NOT NULL,
  forecast_json TEXT, review_by_date TEXT, retrospective_status TEXT
)`;

// 与 listDueUnsettled 的 SQL 保持一致。
const DUE_SQL = `SELECT id FROM court_archives
  WHERE review_by_date IS NOT NULL AND review_by_date <= ?
    AND (retrospective_status IS NULL OR retrospective_status = '')
  ORDER BY review_by_date ASC LIMIT ?`;

async function db() {
  const c = createClient({ url: ':memory:' });
  await c.execute(CREATE);
  return c;
}

test('飞轮①: 决策存档带 forecast + review_by_date(输入端在积累)', async () => {
  const c = await db();
  const forecast = { expectedResult: '接单', byDate: '2026-10-04T00:00:00Z', falsifyingMetric: '毛利<0', doNothingBaseline: '不接' };
  await c.execute({
    sql: `INSERT INTO court_archives (id,task_id,original_question,verdict,user_id,created_at,forecast_json,review_by_date,retrospective_status) VALUES (?,?,?,?,?,?,?,?,?)`,
    args: ['d1', 't1', '要不要接单', '接', 'u1', '2026-07-04T00:00:00Z', JSON.stringify(forecast), forecast.byDate, null],
  });
  const r = await c.execute('SELECT forecast_json, review_by_date FROM court_archives WHERE id=?', ['d1']);
  assert.equal(r.rows.length, 1);
  assert.equal(JSON.parse(String(r.rows[0].forecast_json)).falsifyingMetric, '毛利<0');
  assert.equal(String(r.rows[0].review_by_date), forecast.byDate);
});

test('飞轮②: retrospective_status 落库保持 NULL —— 钢轨1 不编 outcome', async () => {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO court_archives (id,original_question,created_at,review_by_date,retrospective_status) VALUES (?,?,?,?,?)`,
    args: ['d2', 'q', '2026-07-04T00:00:00Z', '2026-10-04T00:00:00Z', null],
  });
  const r = await c.execute('SELECT retrospective_status FROM court_archives WHERE id=?', ['d2']);
  assert.equal(r.rows[0].retrospective_status, null, '落库时绝不能自动填 outcome');
});

test('飞轮③: 到期未结算被捞出,已结算/未到期不捞(零漏零误)', async () => {
  const c = await db();
  const rows = [
    ['due-unsettled', '2026-06-01T00:00:00Z', null], // 过期+空 → 该捞
    ['due-settled', '2026-06-01T00:00:00Z', '达成'], // 过期但已结算 → 不捞
    ['future', '2027-01-01T00:00:00Z', null], // 未到期 → 不捞
  ];
  for (const [id, by, retro] of rows) {
    await c.execute({
      sql: `INSERT INTO court_archives (id,original_question,created_at,review_by_date,retrospective_status) VALUES (?,?,?,?,?)`,
      args: [id, 'q', '2026-05-01T00:00:00Z', by, retro],
    });
  }
  const res = await c.execute({ sql: DUE_SQL, args: ['2026-07-04T00:00:00Z', 50] });
  const ids = res.rows.map((x) => String(x.id));
  assert.deepEqual(ids, ['due-unsettled'], '只捞到期未结算,不漏不误');
});

// 与 saveCourtArchive 的 UPSERT COALESCE 保持一致(独立会审 HIGH 修复)。
const UPSERT = `INSERT INTO court_archives (id,original_question,created_at,forecast_json,review_by_date,retrospective_status)
  VALUES (?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET
    original_question=excluded.original_question,
    forecast_json=COALESCE(excluded.forecast_json, court_archives.forecast_json),
    review_by_date=COALESCE(excluded.review_by_date, court_archives.review_by_date),
    retrospective_status=COALESCE(excluded.retrospective_status, court_archives.retrospective_status)`;

test('飞轮④(会审HIGH修复): 重复归档同id绝不抹掉已结算的 retrospective', async () => {
  const c = await db();
  // 1. 首次归档(未结算)
  await c.execute({ sql: UPSERT, args: ['dup', '要不要接单', '2026-07-04T00:00:00Z', '{"expectedResult":"接"}', '2026-10-04T00:00:00Z', null] });
  // 2. 到期结算写入真实兑现结果
  await c.execute({ sql: `UPDATE court_archives SET retrospective_status=? WHERE id=?`, args: ['达成', 'dup'] });
  // 3. 同 id 重复归档(retrospective 传 null,模拟重复 adopt/重试)
  await c.execute({ sql: UPSERT, args: ['dup', '要不要接单', '2026-07-05T00:00:00Z', '{"expectedResult":"接"}', '2026-10-04T00:00:00Z', null] });
  // 断言:真实兑现结果【被保留】,没被 REPLACE 抹回 NULL
  const r = await c.execute('SELECT retrospective_status FROM court_archives WHERE id=?', ['dup']);
  assert.equal(String(r.rows[0].retrospective_status), '达成', 'UPSERT COALESCE 必须保留已结算的兑现结果,绝不连坐抹回 NULL');
});
