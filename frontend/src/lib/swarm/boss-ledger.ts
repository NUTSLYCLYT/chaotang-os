/**
 * boss-ledger —— Bezos 判断飞轮（会审天才设计）。
 *
 * 把丞相 merge 的每次产出 + 老板的最终拍板（改了/否了/原样签了哪一行）写进一条 SHA256 哈希链
 * （tamper-evident，每条 hash = sha256(prev_hash + 内容)），并从老板**真实签字行为**累积偏好：
 * 下次同一条冲突边再起，merge 附上"历史上陛下在此冲突 N/M 次选了 X 部"的学习先验——
 * 但**绝不自动裁决**（仍伏候圣裁），只是越用越懂这位老板，且完全可审计。这才是规模效应该积累的客户优势。
 *
 * fire-and-forget 友好 + try/catch：台账失败绝不影响主响应。
 */

import { createHash } from 'node:crypto';
import { getDb } from '@/lib/db/turso';
import { ledgerDb } from './ledger-db';
import { logger } from '@/lib/logger';
import { getDepartmentLabel } from '@/lib/contracts/prime-minister';

const GENESIS = '0'.repeat(64);
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
let ensured = false;

// 大神会审一票否决项：判【人】的部门，其冲突边【永不】进飞轮学习——绝不固化/放大老板用人偏见。
// 飞轮可学"什么系统修复有效"，永远不许学"老板偏爱哪类人"。
const PEOPLE_JUDGMENT_DEPTS = new Set(['人和部', 'hr', 'li_bu', '吏部']);
function isPeopleEdge(edge: string): boolean {
  return edge.split('|').some((d) => PEOPLE_JUDGMENT_DEPTS.has(d));
}

async function ensureTables(db: ReturnType<typeof getDb>): Promise<void> {
  if (ensured) return;
  await db.execute(
    `CREATE TABLE IF NOT EXISTS boss_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      verdict TEXT NOT NULL DEFAULT '',
      escalated INTEGER NOT NULL DEFAULT 0,
      edges_json TEXT NOT NULL DEFAULT '[]',
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      outcome TEXT,            -- signed | rejected | edited（老板拍板，初始 NULL）
      chosen_dept TEXT,        -- 冲突中老板选了哪一侧
      outcome_note TEXT,
      outcome_hash TEXT,       -- sha256(hash + outcome 内容)，把签字也焊进链
      outcome_at TEXT,
      task_id TEXT,            -- 本次决策所属 taskId(会审HIGH修复2026-07-03：无此列时
                                -- archive-backfill 只能靠"任意归档存在"匹配，导致陈旧签核
                                -- 被不相关归档误配对重复计数，见 real-source.ts verifyEvidence)
      created_at TEXT NOT NULL
    )`,
  );
  // 存量库兜底(libSQL/SQLite 无可移植 ADD COLUMN IF NOT EXISTS，同 archive-store.ts 惯用法)。
  for (const col of ['task_id TEXT']) {
    try {
      await db.execute(`ALTER TABLE boss_decisions ADD COLUMN ${col}`);
    } catch {
      // 旧库可能已有该列。
    }
  }
  await db.execute(
    `CREATE TABLE IF NOT EXISTS boss_preferences (
      edge TEXT NOT NULL,      -- 冲突边，如 "兵部|户部"
      dept TEXT NOT NULL,      -- 老板偏向的部门
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (edge, dept)
    )`,
  );
  ensured = true;
}

export interface OrchestrationRecord {
  id: number;
  hash: string;
}

/**
 * 记录一次丞相 merge 产出，焊进哈希链，返回 decisionId。
 * @param taskId 本次决策所属 taskId(会审HIGH修复2026-07-03)：让 archive-backfill.ts 能验证
 *   "这次归档真的是这条签核在等的那次归档"，而不是"任意一个归档存在就算数"，见 real-source.ts。
 */
export async function recordOrchestration(
  command: string,
  merge: { verdict: string; escalateToBoss: boolean; conflicts: Array<{ depts: string[] }> },
  nowIso: string,
  taskId?: string | null,
): Promise<OrchestrationRecord | null> {
  try {
    const db = await ledgerDb();
    await ensureTables(db);
    const { rows } = await db.execute('SELECT hash FROM boss_decisions ORDER BY id DESC LIMIT 1');
    const prevHash = rows[0] ? String((rows[0] as Record<string, unknown>).hash) : GENESIS;
    const edges = merge.conflicts.map((c) => [...c.depts].sort().join('|'));
    // Schneier(验收会审):涉及判人部门的决策，原始指令是法务负债——脱敏，别建可被传唤的证据仓库。
    const hasPeople = edges.some(isPeopleEdge);
    const storedCommand = hasPeople ? '[人事相关决策·原文已脱敏，仅记类型与冲突边]' : command.slice(0, 2000);
    const storedVerdict = hasPeople ? '[人事相关·裁断摘要已脱敏]' : merge.verdict.slice(0, 4000);
    const content = JSON.stringify({ command: storedCommand, verdict: storedVerdict, escalated: merge.escalateToBoss, edges, at: nowIso });
    const hash = sha256(prevHash + content); // hash 覆盖脱敏后内容 → 链仍可验、却不留 PII 弹药
    const res = await db.execute({
      sql: `INSERT INTO boss_decisions (command, verdict, escalated, edges_json, prev_hash, hash, task_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [storedCommand, storedVerdict, merge.escalateToBoss ? 1 : 0, JSON.stringify(edges), prevHash, hash, taskId ?? null, nowIso],
    });
    return { id: Number(res.lastInsertRowid ?? 0), hash };
  } catch (e) {
    logger.error('[boss-ledger] recordOrchestration failed (non-fatal)', { reason: String(e) });
    return null;
  }
}

/** 老板拍板：把签字焊进链 + 从真实选择累积偏好。 */
export async function signOff(
  decisionId: number,
  action: 'signed' | 'rejected' | 'edited',
  chosenDept: string | null,
  note: string | null,
  nowIso: string,
): Promise<{ ok: boolean; outcomeHash?: string; alreadySigned?: boolean; learned?: number }> {
  try {
    const db = await ledgerDb();
    await ensureTables(db);
    const { rows } = await db.execute({ sql: 'SELECT hash, edges_json, outcome FROM boss_decisions WHERE id = ?', args: [decisionId] });
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return { ok: false };
    // 幂等(R5):每条决策只能圣裁一次。否则攻击者枚举自增 decisionId 反复 signOff,
    // 每次 boss_preferences +1,即可把"陛下学习先验"投毒成任意部门偏向。
    if (row.outcome != null && String(row.outcome) !== '') {
      return { ok: false, alreadySigned: true };
    }
    const outcomeHash = sha256(String(row.hash) + JSON.stringify({ action, chosenDept, note, at: nowIso }));
    // 条件写:仅当 outcome 仍为空才落定,DB 原子保证"恰好一次",堵住 SELECT→UPDATE 之间的并发竞态。
    const upd = await db.execute({
      sql: `UPDATE boss_decisions SET outcome = ?, chosen_dept = ?, outcome_note = ?, outcome_hash = ?, outcome_at = ?
            WHERE id = ? AND (outcome IS NULL OR outcome = '')`,
      args: [action, chosenDept, note?.slice(0, 1000) ?? null, outcomeHash, nowIso, decisionId],
    });
    if (!upd.rowsAffected) {
      return { ok: false, alreadySigned: true };
    }
    // 从真实签字累积偏好：老板在某条冲突边选了 chosenDept → 该边该部门 +1。
    // 归一化：chosenDept 可能是部门代号(bing_bu)或中文名(兵部)，统一成中文名以匹配边(用中文名)。
    let learned = 0;
    if (chosenDept && (action === 'signed' || action === 'edited')) {
      const edges = JSON.parse(String(row.edges_json ?? '[]')) as string[];
      const me = getDepartmentLabel(chosenDept);
      for (const edge of edges) {
        if (isPeopleEdge(edge)) continue; // 判人部门：永不学偏好（一票否决项）
        if (!edge.split('|').includes(me)) continue;
        await db.execute({
          sql: `INSERT INTO boss_preferences (edge, dept, count) VALUES (?, ?, 1)
                ON CONFLICT(edge, dept) DO UPDATE SET count = count + 1`,
          args: [edge, me],
        });
        learned += 1;
      }
      // 守恒断言（铁律2 / Deming flywheel_health）：拍板带了 chosenDept 却一条边都没累积，
      // 是静默漏写（决策无硬冲突边 / 部门命名漂移 / 全是判人边）。绝不静默——loud warn，
      // 让审计能区分"飞轮在转"与"空转写丢"，否则"镜鉴"会悄悄少算老板历史、对他撒小谎。
      if (learned === 0) {
        logger.warn('[boss-ledger] signOff 偏好零累积（chosenDept 未匹配任何可学冲突边）', {
          decisionId,
          chosenDept,
          normalized: me,
          edges,
          hint: edges.length === 0 ? '该决策无硬冲突边（不该带 chosenDept 拍板）' : '命名漂移或全为判人边',
        });
      }
    }
    return { ok: true, outcomeHash, learned };
  } catch (e) {
    logger.error('[boss-ledger] signOff failed (non-fatal)', { reason: String(e) });
    return { ok: false };
  }
}

export interface BossPrior {
  edge: string;
  tally: Record<string, number>; // 部门 → 老板历史选它的次数
  total: number;
}

export interface BossDecisionOutcomeEvidence {
  id: number;
  outcome: 'signed' | 'rejected' | 'edited';
  chosenDept: string | null;
  outcomeHash: string;
  outcomeAt: string;
  /** 本条签核所属 taskId(会审HIGH修复2026-07-03)；旧库无此列的存量行为 null，调用方需降级处理。 */
  taskId: string | null;
}

/** 查一条已签核的 boss_decision，供学习飞轮做真实结果源校验。 */
export async function loadBossDecisionOutcomeEvidence(decisionId: number): Promise<BossDecisionOutcomeEvidence | null> {
  if (!Number.isInteger(decisionId) || decisionId <= 0) return null;
  try {
    const db = await ledgerDb();
    await ensureTables(db);
    const { rows } = await db.execute({
      sql: `SELECT id, outcome, chosen_dept, outcome_hash, outcome_at, task_id
            FROM boss_decisions
            WHERE id = ? AND outcome IN ('signed','rejected','edited')
              AND outcome_hash IS NOT NULL AND outcome_hash != ''
            LIMIT 1`,
      args: [decisionId],
    });
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: Number(row.id),
      outcome: String(row.outcome) as BossDecisionOutcomeEvidence['outcome'],
      chosenDept: row.chosen_dept ? String(row.chosen_dept) : null,
      outcomeHash: String(row.outcome_hash),
      outcomeAt: String(row.outcome_at),
      taskId: row.task_id ? String(row.task_id) : null,
    };
  } catch (e) {
    logger.error('[boss-ledger] loadBossDecisionOutcomeEvidence failed (non-fatal)', { reason: String(e), decisionId });
    return null;
  }
}

export interface FlywheelHealth {
  signoffsWithDept: number; // 带 chosenDept 的 signed/edited 拍板数
  prefIncrementsTotal: number; // boss_preferences 累积总量（实际学到的量）
  zeroEdgeSignoffs: number; // 带 chosenDept 却决策无边 → 静默漏写/枚举投毒嫌疑（应为 0）
  prefEdges: number; // 已学到偏好的不同冲突边数
  conserved: boolean; // zeroEdgeSignoffs === 0 且 prefIncrementsTotal > 0（或无拍板）
}

/**
 * flywheel_health（Deming）：把"飞轮在转 vs 空转写丢"变成可 grep 的数字。
 * 守恒直觉：每条"带 chosenDept、有冲突边、非判人边"的拍板都该贡献 ≥1 次偏好累积；
 * zeroEdgeSignoffs>0 即出现"签了却零累积"的静默漏写（如对无冲突决策硬拍板 / 命名漂移 / 投毒枚举）。
 */
export async function flywheelHealth(): Promise<FlywheelHealth> {
  const empty: FlywheelHealth = { signoffsWithDept: 0, prefIncrementsTotal: 0, zeroEdgeSignoffs: 0, prefEdges: 0, conserved: true };
  try {
    const db = await ledgerDb();
    await ensureTables(db);
    const sw = await db.execute(
      `SELECT COUNT(*) AS n FROM boss_decisions
       WHERE outcome IN ('signed','edited') AND chosen_dept IS NOT NULL AND chosen_dept != ''`,
    );
    const ze = await db.execute(
      `SELECT COUNT(*) AS n FROM boss_decisions
       WHERE outcome IN ('signed','edited') AND chosen_dept IS NOT NULL AND chosen_dept != ''
         AND (edges_json IS NULL OR edges_json = '[]' OR edges_json = '')`,
    );
    const pref = await db.execute('SELECT COUNT(*) AS edges, COALESCE(SUM(count),0) AS total FROM boss_preferences');
    const signoffsWithDept = Number((sw.rows[0] as Record<string, unknown>)?.n ?? 0);
    const zeroEdgeSignoffs = Number((ze.rows[0] as Record<string, unknown>)?.n ?? 0);
    const prefRow = pref.rows[0] as Record<string, unknown>;
    const prefIncrementsTotal = Number(prefRow?.total ?? 0);
    const prefEdges = Number(prefRow?.edges ?? 0);
    const conserved = zeroEdgeSignoffs === 0 && (signoffsWithDept === 0 || prefIncrementsTotal > 0);
    return { signoffsWithDept, prefIncrementsTotal, zeroEdgeSignoffs, prefEdges, conserved };
  } catch (e) {
    logger.error('[boss-ledger] flywheelHealth failed (non-fatal)', { reason: String(e) });
    return empty;
  }
}

/** 读某条冲突边的学习先验（老板历史偏好）。空数据返回 total:0。 */
export async function loadBossPrior(edge: string): Promise<BossPrior> {
  try {
    const db = await ledgerDb();
    await ensureTables(db);
    const { rows } = await db.execute({ sql: 'SELECT dept, count FROM boss_preferences WHERE edge = ?', args: [edge] });
    const tally: Record<string, number> = {};
    let total = 0;
    for (const r of rows as unknown as Array<Record<string, unknown>>) {
      const c = Number(r.count ?? 0);
      tally[String(r.dept)] = c;
      total += c;
    }
    return { edge, tally, total };
  } catch {
    return { edge, tally: {}, total: 0 };
  }
}
