/**
 * decision-ledger —— 单 agent 决策台账（一张表服务四个会审诉求）：
 *   · trace 台账（Charity Majors/Harrison Chase）：每次 ask 落一条高基数宽事件，可事后任意切片。
 *   · 共享黑板 / stigmergy（E.O. Wilson）：loadRecentConflicts 让一个部门下一轮 buildContext
 *     "闻到"他部刚声明的冲突——没有 agent 裁决 agent，群体却能收敛。
 *   · 护城河失败集（Karpathy）：grounded=0 的子集即"模型在哪些衍生量上幻觉"的语料。
 *   · outcome 对账底座（Wilson/Deming）：outcome 列可空，待真实结果回填 → 让"接地率"被真实世界裁决。
 *
 * 全部 fire-and-forget + try/catch：台账失败绝不影响主响应。
 */

import { getDb } from '@/lib/db/turso';
import { ledgerDb } from './ledger-db';
import { logger } from '@/lib/logger';
import { DEPT_DISPLAY } from '@/lib/contracts/dept';
import { swarmToCn } from './dept-identity';
import type { AgentResult } from './dept-agent';

let ensured = false;

async function ensureTable(db: ReturnType<typeof getDb>): Promise<void> {
  if (ensured) return;
  await db.execute(
    `CREATE TABLE IF NOT EXISTS agent_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept TEXT NOT NULL,
      command TEXT NOT NULL,
      answer TEXT NOT NULL DEFAULT '',
      grounded INTEGER NOT NULL DEFAULT 1,
      grounding_rate REAL NOT NULL DEFAULT 1,
      evidence_bound_rate REAL NOT NULL DEFAULT 1,
      confidence REAL NOT NULL DEFAULT 0,
      conflicts TEXT NOT NULL DEFAULT '无',
      reprompted INTEGER NOT NULL DEFAULT 0,
      model TEXT NOT NULL DEFAULT '',
      latency_ms INTEGER NOT NULL DEFAULT 0,
      ungrounded_json TEXT NOT NULL DEFAULT '[]',
      outcome TEXT,            -- 真实结果回填（Wilson/Deming 闭环），初始 NULL
      outcome_at TEXT,
      created_at TEXT NOT NULL
    )`,
  );
  // Deming Study 回路：归因对账裁断列（'confirmed'|'refuted'）。老表无此列 → 安全补列，重复忽略。
  try {
    await db.execute(`ALTER TABLE agent_decisions ADD COLUMN outcome_verdict TEXT`);
  } catch {
    /* duplicate column —— 已存在，幂等忽略 */
  }
  ensured = true;
}

/** 记录一条决策（每次 ask 都记，不只失败）。 */
export async function recordDecision(
  dept: string,
  command: string,
  result: AgentResult,
  createdAtIso: string,
): Promise<number | null> {
  try {
    const db = await ledgerDb();
    await ensureTable(db);
    // Schneier(验收会审)：判人部门的原始指令是 PII/法务负债 → 脱敏存档（answer 本身系统级、不点名，保留供对账）。
    const isPeople = swarmToCn(dept) === '人和部';
    const storedCommand = isPeople ? '[人事相关·原文已脱敏]' : command.slice(0, 2000);
    const res = await db.execute({
      sql: `INSERT INTO agent_decisions
              (dept, command, answer, grounded, grounding_rate, evidence_bound_rate, confidence,
               conflicts, reprompted, model, latency_ms, ungrounded_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        dept,
        storedCommand,
        String(result.answer ?? '').slice(0, 4000),
        result.grounded ? 1 : 0,
        result.grounding?.rate ?? 1,
        result.evidenceBinding?.rate ?? 1,
        result.confidence ?? 0,
        String(result.conflicts ?? '无').slice(0, 2000),
        result.reprompted ? 1 : 0,
        result.model ?? '',
        result.latencyMs ?? 0,
        JSON.stringify(result.grounding?.ungrounded ?? []),
        createdAtIso,
      ],
    });
    // Wilson 浓度场：本部 conflicts 里点名了哪些他部 → 强化那条冲突边
    const conflictsText = String(result.conflicts ?? '');
    if (conflictsText && conflictsText !== '无') {
      const others = ['户部', '兵部', '刑部', '工部', '礼部', '锦衣卫', '太医院'].filter(
        (n) => n !== DEPT_CN[dept] && conflictsText.includes(n),
      );
      for (const other of others) await reinforceEdge(dept, other, createdAtIso);
    }
    return Number(res.lastInsertRowid ?? 0) || null;
  } catch (e) {
    logger.error('[decision-ledger] record failed (non-fatal)', { dept, reason: String(e) });
    return null;
  }
}

export interface PriorSignal {
  dept: string;
  conflicts: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Wilson 双向浓度场（会审天才设计）：把 conflicts 从"单向死痕迹"升级成"会强化/蒸发的浓度场"。
 * 每条部门冲突边(户部↔兵部)有一个 strength：被反复声明则强化(+1)，随时间半衰蒸发(7 天半衰)。
 * 高浓度边 = 蜂群反复撞上的真断层线 → 收敛；久未触碰的边自然蒸发消失。不靠任何 agent 裁决。
 * ────────────────────────────────────────────────────────────────────────── */

const HALFLIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天半衰
let fieldEnsured = false;

async function ensureFieldTable(db: ReturnType<typeof getDb>): Promise<void> {
  if (fieldEnsured) return;
  await db.execute(
    `CREATE TABLE IF NOT EXISTS conflict_field (
      edge TEXT PRIMARY KEY,        -- 排序后的部门对，如 "兵部|户部"
      strength REAL NOT NULL DEFAULT 0,
      last_at TEXT NOT NULL
    )`,
  );
  fieldEnsured = true;
}

const edgeKey = (a: string, b: string): string => [cnName(a), cnName(b)].sort().join('|');
function cnName(code: string): string {
  return DEPT_CN[code] ?? code;
}
const decay = (s: number, lastMs: number, nowMs: number): number =>
  s * Math.pow(0.5, Math.max(0, nowMs - lastMs) / HALFLIFE_MS);

/** 强化一条冲突边（部门 from 在 conflicts 里点名了 to）：先按时间蒸发，再 +1。 */
export async function reinforceEdge(deptFrom: string, deptTo: string, nowIso: string): Promise<void> {
  if (cnName(deptFrom) === cnName(deptTo)) return;
  try {
    const db = await ledgerDb();
    await ensureFieldTable(db);
    const key = edgeKey(deptFrom, deptTo);
    const nowMs = Date.parse(nowIso) || Date.now();
    const { rows } = await db.execute({ sql: 'SELECT strength, last_at FROM conflict_field WHERE edge = ?', args: [key] });
    const prev = rows[0] as Record<string, unknown> | undefined;
    const base = prev ? decay(Number(prev.strength ?? 0), Date.parse(String(prev.last_at)) || nowMs, nowMs) : 0;
    const strength = +(base + 1).toFixed(3);
    await db.execute({
      sql: `INSERT INTO conflict_field (edge, strength, last_at) VALUES (?, ?, ?)
            ON CONFLICT(edge) DO UPDATE SET strength = excluded.strength, last_at = excluded.last_at`,
      args: [key, strength, nowIso],
    });
  } catch (e) {
    logger.error('[conflict-field] reinforce failed (non-fatal)', { reason: String(e) });
  }
}

export interface FieldEdge { edge: string; other: string; strength: number }

/** 读浓度场：取涉及本部门、蒸发后仍高于阈值的边，按浓度降序。 */
export async function loadConflictField(dept: string, threshold = 0.4, limit = 5): Promise<FieldEdge[]> {
  try {
    const db = await ledgerDb();
    await ensureFieldTable(db);
    const me = cnName(dept);
    const nowMs = Date.now();
    const { rows } = await db.execute('SELECT edge, strength, last_at FROM conflict_field');
    return (rows as unknown as Array<Record<string, unknown>>)
      .map((r) => {
        const edge = String(r.edge);
        const s = decay(Number(r.strength ?? 0), Date.parse(String(r.last_at)) || nowMs, nowMs);
        return { edge, strength: +s.toFixed(2), parts: edge.split('|') };
      })
      .filter((x) => x.parts.includes(me) && x.strength >= threshold)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit)
      .map((x) => ({ edge: x.edge, other: x.parts.find((p) => p !== me) ?? '', strength: x.strength }));
  } catch (e) {
    logger.error('[conflict-field] load failed (non-fatal)', { reason: String(e) });
    return [];
  }
}

/** 浓度场 → PriorSignal（注入 buildContext，标注浓度）。 */
export function fieldToSignals(field: FieldEdge[]): PriorSignal[] {
  return field.map((f) => ({
    dept: f.other,
    conflicts: `[持续高浓度断层·浓度${f.strength}] 本部与${f.other}反复冲突，是蜂群收敛出的真断层线，请在与其交界处格外审慎。`,
  }));
}

/** 部门码→中文名:canonical 6 派生自 SSOT contracts/dept.ts DEPT_DISPLAY(铁律2),余为别名/拼写变体。 */
export const DEPT_CN: Record<string, string> = {
  ...Object.fromEntries(Object.entries(DEPT_DISPLAY).map(([code, d]) => [code, d.nameCn])),
  hubu: '户部', works: '工部', gong_bu: '工部', gongbu: '工部',
};

/**
 * 把他部冲突信号格式化进 context（stigmergy 注入块）。明确"供参考、勿替他们下结论"，
 * 不触发任何 agent 裁决 agent —— 这是 Wilson 共享黑板 = Chase 去中心化 merge node 的最小实现。
 */
export function formatBlackboard(signals: PriorSignal[]): string {
  if (!signals || signals.length === 0) return '';
  const lines = signals
    .map((s) => `· [${DEPT_CN[s.dept] ?? s.dept}] ${s.conflicts}`)
    .join('\n');
  return `\n\n【他部近期冲突信号（共享黑板·供参考，勿替他们下结论，可据此修正你与他们交界处的判断）】\n${lines}`;
}

/**
 * 共享黑板读取（stigmergy）：取其他部门最近声明的非空 conflicts，供本部门 buildContext 注入。
 * 失败返回空数组（黑板不可用不阻断决策）。
 */
export async function loadRecentConflicts(excludeDept: string, limit = 5): Promise<PriorSignal[]> {
  try {
    const db = await ledgerDb();
    await ensureTable(db);
    const { rows } = await db.execute({
      sql: `SELECT dept, conflicts FROM agent_decisions
            WHERE dept != ? AND conflicts IS NOT NULL AND conflicts != '无' AND conflicts != ''
            ORDER BY id DESC LIMIT ?`,
      args: [excludeDept, limit],
    });
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      dept: String(r.dept ?? ''),
      conflicts: String(r.conflicts ?? ''),
    }));
  } catch (e) {
    logger.error('[decision-ledger] loadRecentConflicts failed (non-fatal)', { reason: String(e) });
    return [];
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Deming Study 回路（验收会审 5:0 处方）：把体温计从「只 Plan-Do（报警）」升到「Study（对账）」。
 *   · recordOutcome：事后把真实结果 + 归因裁断（证实/证伪）回填到对应决策行 —— 开环变闭环。
 *   · loadOpenStudies：列出尚未对账的决策（待事后核验），逼出"只报警不行动"的尾巴。
 *   · loadAttributionCalibration：聚合本部历史归因对账率 → 注回 context，让 agent 看见自己
 *     "上几次把噪声当信号"的校准分。学的是【归因准不准】，绝不学老板偏好（不碰飞轮护栏）。
 * ────────────────────────────────────────────────────────────────────────── */

export type OutcomeVerdict = 'confirmed' | 'refuted';

/** 回填真实结果 + 归因裁断。幂等：仅当该行 outcome 仍为 NULL 时写入（防重复对账）。返回是否成功落账。 */
export async function recordOutcome(
  decisionId: number,
  outcome: string,
  verdict: OutcomeVerdict,
  nowIso: string,
): Promise<boolean> {
  try {
    const db = await ledgerDb();
    await ensureTable(db);
    const res = await db.execute({
      sql: `UPDATE agent_decisions
            SET outcome = ?, outcome_verdict = ?, outcome_at = ?
            WHERE id = ? AND outcome IS NULL`,
      args: [String(outcome).slice(0, 2000), verdict, nowIso, decisionId],
    });
    return Number(res.rowsAffected ?? 0) > 0;
  } catch (e) {
    logger.error('[decision-ledger] recordOutcome failed (non-fatal)', { decisionId, reason: String(e) });
    return false;
  }
}

export interface StudyRow {
  id: number;
  dept: string;
  command: string;
  answer: string;
  conflicts: string;
  confidence: number;
  createdAt: string;
}

/** 待对账决策（outcome 仍空）——这是 Deming 说的"只 Plan-Do 没 Study"的待办尾巴。 */
export async function loadOpenStudies(dept?: string, limit = 20): Promise<StudyRow[]> {
  try {
    const db = await ledgerDb();
    await ensureTable(db);
    const where = dept ? 'WHERE outcome IS NULL AND dept = ?' : 'WHERE outcome IS NULL';
    const args = dept ? [dept, limit] : [limit];
    const { rows } = await db.execute({
      sql: `SELECT id, dept, command, answer, conflicts, confidence, created_at
            FROM agent_decisions ${where} ORDER BY id DESC LIMIT ?`,
      args,
    });
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id ?? 0),
      dept: String(r.dept ?? ''),
      command: String(r.command ?? ''),
      answer: String(r.answer ?? ''),
      conflicts: String(r.conflicts ?? ''),
      confidence: Number(r.confidence ?? 0),
      createdAt: String(r.created_at ?? ''),
    }));
  } catch (e) {
    logger.error('[decision-ledger] loadOpenStudies failed (non-fatal)', { reason: String(e) });
    return [];
  }
}

export interface AttributionCalibration {
  total: number; // 已对账数
  confirmed: number;
  refuted: number;
  rate: number; // 证实率 confirmed/total（total=0 时为 1，乐观先验）
}

/** 本部历史归因对账率（只统计已回填 outcome_verdict 的行）。 */
export async function loadAttributionCalibration(dept: string): Promise<AttributionCalibration> {
  const empty: AttributionCalibration = { total: 0, confirmed: 0, refuted: 0, rate: 1 };
  try {
    const db = await ledgerDb();
    await ensureTable(db);
    const { rows } = await db.execute({
      sql: `SELECT outcome_verdict AS v, COUNT(*) AS c
            FROM agent_decisions
            WHERE dept = ? AND outcome_verdict IN ('confirmed', 'refuted')
            GROUP BY outcome_verdict`,
      args: [dept],
    });
    let confirmed = 0;
    let refuted = 0;
    for (const r of rows as unknown as Array<Record<string, unknown>>) {
      const c = Number(r.c ?? 0);
      if (String(r.v) === 'confirmed') confirmed = c;
      else if (String(r.v) === 'refuted') refuted = c;
    }
    const total = confirmed + refuted;
    return { total, confirmed, refuted, rate: total ? +(confirmed / total).toFixed(2) : 1 };
  } catch (e) {
    logger.error('[decision-ledger] loadAttributionCalibration failed (non-fatal)', { reason: String(e) });
    return empty;
  }
}

/** 把校准分格式化进 context：让 agent 看见自己过去的归因对账率（Deming：让接地率被真实世界裁决）。 */
export function formatCalibration(c: AttributionCalibration): string {
  if (c.total === 0) {
    return '\n\n【归因校准（Study 回路）】本部尚无已对账归因——你这次的结论将被事后真实结果对账，' +
      '请确保每个归因可证伪（说清"若X则证明我错"），别把噪声当信号供奉。';
  }
  const pct = Math.round(c.rate * 100);
  const warn =
    c.rate < 0.6
      ? `⚠️ 证伪率偏高（${c.refuted}/${c.total}）——本轮务必先质疑：我是不是又把小样本波动当成了系统信号？先给出三个"不是这个组的人"的解释再下结论。`
      : '保持：归因可证伪、先怀疑噪声再报信号。';
  return `\n\n【归因校准（Study 回路）】本部历史归因已对账 ${c.total} 次：证实 ${c.confirmed} / 证伪 ${c.refuted}（证实率 ${pct}%）。${warn}`;
}
