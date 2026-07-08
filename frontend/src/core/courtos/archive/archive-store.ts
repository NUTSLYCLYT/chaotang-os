/**
 * 史馆持久化（Loop7 复利根）—— 归档每次决策，并支持同类问题召回旧案。
 *
 * 自举建表（CREATE TABLE IF NOT EXISTS），不依赖共享 schema.ts/migrate.ts，隔离降风险。
 * server-only：用 @/lib/db/turso 的 getDb（file: 本地兜底 / Turso 生产）。
 * 仅记录"决策历史"（咨询性），不触碰真实产线资产 → 符合 AGENTS §13.9。
 */
import 'server-only';
import { getDb } from '@/lib/db/turso';
import { logger } from '@/lib/logger';
import { buildRecallQuery, buildArchiveRecordsRecallQuery, NON_RECALLABLE_SOURCES } from './recall-guard';
import { ensurePrimaryDbReady } from '@/lib/db/primary-store';
import type { SourceLabel } from '../types';
import type { ShiguanArchiveRecordV1 } from '@/lib/shangshufang/local-decision-loop';

export interface CourtArchiveRecord {
  id: string;
  taskId: string;
  /** 租户归属(必填,CRITICAL#3 跨租户隔离)。optional/?? 默认值=静默回退=违铁律2,会让漏传伪装成功并落 NULL 泄露候选。 */
  userId: string;
  originalQuestion: string;
  refinedIntent?: string;
  verdict?: string;
  sourceLabel?: SourceLabel;
  overallSignal?: string;
  missingEvidence?: string[];
  needsHumanConfirmation?: boolean;
  reusableLessons?: string[];
  archiveRecord?: ShiguanArchiveRecordV1;
  /** 合成案(源标 FALLBACK/DEMO);缺省按 sourceLabel 计算同口径。 */
  synthetic?: boolean;
  createdAt: string; // ISO，由调用方传入（runtime 无 Date.now 约束时在边界生成）
  /** 决策飞轮·可证伪预测(到期兑现用)。缺=该决策不进兑现追踪。照 chancellor/mandate.ts ForecastAccount。 */
  forecast?: {
    expectedResult: string;
    byDate: string; // ISO 到期兑现日
    falsifyingMetric: string;
    doNothingBaseline: string;
  };
  /** 到期兑现日(=forecast.byDate,冗余出便于调度器按列索引)。 */
  reviewByDate?: string;
  /** 兑现结果(到期结算写回;无真结果保持 undefined,绝不编造·钢轨1)。 */
  retrospectiveStatus?: string;
}

/** 合成度口径:源标为 FALLBACK/DEMO 即合成案,不得当可引用先例。单一真相源 = recall-guard.NON_RECALLABLE_SOURCES(防写入/召回口径漂移)。 */
function isSyntheticSource(sourceLabel?: SourceLabel): boolean {
  return sourceLabel != null && (NON_RECALLABLE_SOURCES as readonly string[]).includes(sourceLabel);
}

let ensured = false;
async function ensureTable(): Promise<void> {
  if (ensured) return;
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS court_archives (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      original_question TEXT NOT NULL,
      refined_intent TEXT,
      verdict TEXT,
      source_label TEXT,
      overall_signal TEXT,
      missing_evidence_json TEXT,
      needs_human_confirmation INTEGER,
      reusable_lessons_json TEXT,
      archive_record_json TEXT,
      user_id TEXT,
      synthetic INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      forecast_json TEXT,
      review_by_date TEXT,
      retrospective_status TEXT
    )
  `);
  // 存量库兜底(libSQL/SQLite 无可移植 ADD COLUMN IF NOT EXISTS,沿用本文件 try/catch 惯用法)。
  for (const col of [
    'archive_record_json TEXT',
    'user_id TEXT', // 租户归属(CRITICAL#3 跨租户召回隔离)
    'synthetic INTEGER DEFAULT 0', // 可查询的诚实度维度(合成案不漂白成可引用先例)
    'forecast_json TEXT', // 决策飞轮·可证伪预测
    'review_by_date TEXT', // 到期兑现日(调度器按此列捞待结算)
    'retrospective_status TEXT', // 兑现结果(无真结果保持 NULL·钢轨1)
  ]) {
    try {
      await db.execute(`ALTER TABLE court_archives ADD COLUMN ${col}`);
    } catch {
      // 旧库可能已有该列。
    }
  }
  await db.execute(
    `CREATE INDEX IF NOT EXISTS court_archives_created ON court_archives(created_at DESC)`,
  );
  // 按 user 召回走索引(租户隔离后主路径)。
  await db.execute(
    `CREATE INDEX IF NOT EXISTS court_archives_user_created ON court_archives(user_id, created_at DESC)`,
  );
  // 到期兑现调度器主查询:review_by_date 未来/过期 + retrospective_status 空。
  await db.execute(
    `CREATE INDEX IF NOT EXISTS court_archives_review_due ON court_archives(review_by_date)`,
  );
  ensured = true;
}

export async function saveCourtArchive(rec: CourtArchiveRecord): Promise<void> {
  await ensureTable();
  const db = getDb();
  // fail-closed:空归属落 'anonymous' 桶(只写不召),绝不静默 NULL/伪造真实用户归属(铁律2)。
  const userId = rec.userId && rec.userId.length > 0 ? rec.userId : 'anonymous';
  if (userId === 'anonymous') {
    logger.warn('[archive-store] court_archive 落库缺租户归属,fail-closed 落 anonymous 桶(只写不召)', {
      id: rec.id,
    });
  }
  const synthetic = (rec.synthetic ?? isSyntheticSource(rec.sourceLabel)) ? 1 : 0;
  // forecast 冗余出 review_by_date 供调度器索引;retrospective 落库时恒为传入值(通常空,到期才结算)。
  const reviewByDate = rec.reviewByDate ?? rec.forecast?.byDate ?? null;
  // UPSERT(非 INSERT OR REPLACE):重复归档同 id 时,内容列更新,但 forecast/review/retrospective 用
  // COALESCE 保留旧值——尤其 retrospective_status 是到期单独 UPDATE 写的真实兑现结果,绝不能被重归档抹回 NULL
  // (独立会审 HIGH:确定性 id archive_${taskId} + adopt 无幂等 → 重复归档会静默吃掉兑现记录)。
  await db.execute({
    sql: `INSERT INTO court_archives
      (id, task_id, original_question, refined_intent, verdict, source_label,
       overall_signal, missing_evidence_json, needs_human_confirmation, reusable_lessons_json, archive_record_json, user_id, synthetic, created_at,
       forecast_json, review_by_date, retrospective_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        task_id=excluded.task_id, original_question=excluded.original_question,
        refined_intent=excluded.refined_intent, verdict=excluded.verdict, source_label=excluded.source_label,
        overall_signal=excluded.overall_signal, missing_evidence_json=excluded.missing_evidence_json,
        needs_human_confirmation=excluded.needs_human_confirmation, reusable_lessons_json=excluded.reusable_lessons_json,
        archive_record_json=excluded.archive_record_json, user_id=excluded.user_id, synthetic=excluded.synthetic,
        created_at=excluded.created_at,
        forecast_json=COALESCE(excluded.forecast_json, court_archives.forecast_json),
        review_by_date=COALESCE(excluded.review_by_date, court_archives.review_by_date),
        retrospective_status=COALESCE(excluded.retrospective_status, court_archives.retrospective_status)`,
    args: [
      rec.id,
      rec.taskId,
      rec.originalQuestion,
      rec.refinedIntent ?? null,
      rec.verdict ?? null,
      rec.sourceLabel ?? null,
      rec.overallSignal ?? null,
      JSON.stringify(rec.missingEvidence ?? []),
      rec.needsHumanConfirmation ? 1 : 0,
      JSON.stringify(rec.reusableLessons ?? []),
      rec.archiveRecord ? JSON.stringify(rec.archiveRecord) : null,
      userId,
      synthetic,
      rec.createdAt,
      rec.forecast ? JSON.stringify(rec.forecast) : null,
      reviewByDate,
      rec.retrospectiveStatus ?? null,
    ],
  });
}

/**
 * 到期兑现:结算某决策的 retrospective_status(照钢轨1——无真结果别调此函数,别写"达成")。
 * 指向【活表 court_archives】(不是退役的 shiguan_archives)。到期兑现调度器用。
 */
export async function settleCourtArchiveRetrospective(input: {
  id: string;
  retrospectiveStatus: string;
}): Promise<void> {
  await ensureTable();
  const db = getDb();
  await db.execute({
    sql: `UPDATE court_archives SET retrospective_status = ? WHERE id = ?`,
    args: [input.retrospectiveStatus, input.id],
  });
}

/** 到期未结算清单:review_by_date 已过 且 retrospective_status 空。到期兑现调度器主查询。 */
export async function listDueUnsettled(nowIso: string, limit = 50): Promise<
  Array<{ id: string; question: string; forecast: unknown; reviewByDate: string }>
> {
  await ensureTable();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT id, original_question, forecast_json, review_by_date
          FROM court_archives
          WHERE review_by_date IS NOT NULL AND review_by_date <= ?
            AND (retrospective_status IS NULL OR retrospective_status = '')
          ORDER BY review_by_date ASC LIMIT ?`,
    args: [nowIso, limit],
  });
  return res.rows.map((r) => ({
    id: String(r.id),
    question: String(r.original_question),
    forecast: r.forecast_json ? JSON.parse(String(r.forecast_json)) : null,
    reviewByDate: String(r.review_by_date),
  }));
}

export async function saveShiguanArchiveRecordV1(rec: ShiguanArchiveRecordV1, userId: string): Promise<void> {
  await saveCourtArchive({
    id: rec.archive_id,
    taskId: rec.task_id,
    // 主归档路 owner 由调用方 session 显式注入(V1 记录本身无 user_id 字段);空→saveCourtArchive fail-closed 落 anonymous。
    userId,
    synthetic: rec.synthetic,
    originalQuestion: rec.original_question,
    refinedIntent: rec.draft_edict.refined_edict,
    verdict: rec.memorial.sacred_judgement ?? rec.memorial.verdict,
    sourceLabel: rec.source_label,
    overallSignal: rec.memorial.sacred_judgement ?? rec.memorial.verdict,
    missingEvidence: rec.memorial.missing_evidence ?? rec.memorial.evidence_gaps ?? [],
    needsHumanConfirmation:
      Boolean(rec.memorial.human_confirmation_required) || Boolean(rec.memorial.quality_gate?.human_signoff_required),
    reusableLessons: rec.reusable_lessons,
    archiveRecord: rec,
    createdAt: rec.created_at,
  });
  void import('@/lib/department-learning/archive-backfill')
    .then((module) => module.backfillDepartmentLearningFromArchive(rec))
    .catch((error: unknown) => {
      logger.warn('[archive-store] department learning archive backfill failed (non-fatal)', {
        reason: error instanceof Error ? error.message : String(error),
        archiveId: rec.archive_id,
        taskId: rec.task_id,
      });
    });
}

export async function hasCourtArchive(archiveId: string | undefined): Promise<boolean> {
  if (!archiveId) return false;
  await ensureTable();
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT 1 FROM court_archives WHERE id = ? LIMIT 1',
    args: [archiveId],
  });
  return res.rows.length > 0;
}

export interface PriorCase {
  id: string;
  originalQuestion: string;
  verdict?: string;
  sourceLabel?: string;
  createdAt: string;
  reusableLessons: string[];
  /** 史馆回填结果（LEFT JOIN shiguan_archives.retrospective_status）；无 shiguan 记录时为 undefined（绝不编造）。 */
  retrospectiveStatus?: string;
}

/**
 * 同类旧案召回（复利）。当前用关键词 LIKE（未来可换向量检索）。
 * 取问题中较长的中文/词片做 OR 匹配，按时间倒序取前 N。
 *
 * 阶段4②(2026-07-03)：合并 court_archives(决策先例) + archive_records(finance-intel-loop 归档，
 * 含真实 outcome/lessons)两个来源，按 createdAt 倒序合并后截到 limit——调用方"最多 N 条先例"
 * 的契约不变，不需要感知内部现在有两个数据源。两路查询各自独立走 recall-guard 的 fail-closed/
 * 用户隔离命门，缺一不可召回时各自返回 []，不影响另一路。
 */
export async function findSimilarCourtArchives(
  question: string,
  userId: string | null | undefined,
  limit = 3,
): Promise<PriorCase[]> {
  // MEDIUM 修复(2026-07-03 会审)：allSettled 而非 all——两路来源互相独立，任一异常
  // (如 archive_records 表未就绪)不得拖垮另一路健康结果，决策照常进行只是少一路先例。
  const [courtResult, archiveResult] = await Promise.allSettled([
    findSimilarCourtArchivesOnly(question, userId, limit),
    findSimilarArchiveRecords(question, userId, limit),
  ]);
  if (courtResult.status === 'rejected') {
    logger.warn('[archive-store] court_archives 召回失败(非致命)', { reason: String(courtResult.reason) });
  }
  if (archiveResult.status === 'rejected') {
    logger.warn('[archive-store] archive_records 召回失败(非致命)', { reason: String(archiveResult.reason) });
  }
  const courtCases = courtResult.status === 'fulfilled' ? courtResult.value : [];
  const archiveRecordCases = archiveResult.status === 'fulfilled' ? archiveResult.value : [];
  return [...courtCases, ...archiveRecordCases]
    .sort((a, b) => safeParseTime(b.createdAt) - safeParseTime(a.createdAt))
    .slice(0, limit);
}

/** LOW 修复(2026-07-03 会审)：畸形时间戳排到最后(视为最旧)，而非 NaN 比较的未定义顺序。 */
function safeParseTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? -Infinity : t;
}

async function findSimilarCourtArchivesOnly(
  question: string,
  userId: string | null | undefined,
  limit: number,
): Promise<PriorCase[]> {
  // 租户隔离 + default-deny + 合成/DEMO/FALLBACK 过滤 + OR 链括号(命门),全在 recall-guard 纯函数(可单测)。
  // null = 不召回(用户不可召回/无有效关键词)→ 返回 [](决策照常进行,只是少复利先例)。
  const query = buildRecallQuery(question, userId, limit);
  if (!query) return [];
  await ensureTable();
  const db = getDb();
  const res = await db.execute({ sql: query.sql, args: query.args });
  // TODO(MED-3): 把下面的 row→PriorCase 映射抽成纯函数 `mapRecallRow`，放 recall-guard.ts
  //   （该文件保持无 server-only，可被 nodetest 直接 import 断言 null→undefined 等边界）。
  //   当前不做是因为 PriorCase 类型定义在 archive-store.ts（server-only），
  //   抽取需同步把类型移到 recall-guard.ts 或独立类型文件，scope 超出本次 fix。
  return res.rows.map((r) => ({
    id: String(r.id),
    originalQuestion: String(r.original_question),
    verdict: r.verdict ? String(r.verdict) : undefined,
    sourceLabel: r.source_label ? String(r.source_label) : undefined,
    createdAt: String(r.created_at),
    reusableLessons: safeJsonArray(r.reusable_lessons_json),
    retrospectiveStatus: r.retrospective_status ? String(r.retrospective_status) : undefined,
  }));
}

/**
 * archive_records(finance-intel-loop 归档)召回。隔离粒度决策与命门见 recall-guard.ts
 * `buildArchiveRecordsRecallQuery` 头注释。archive_records 本身无 synthetic/source_label 概念
 * (该功能无 DEMO/演示态，用户真实登录后走真实财务数据采集流程)，故 sourceLabel 恒 undefined，
 * 不冒充某个具体值——诚实展示"这条先例来源未知类型"而非编造。
 */
async function findSimilarArchiveRecords(
  question: string,
  userId: string | null | undefined,
  limit: number,
): Promise<PriorCase[]> {
  const query = buildArchiveRecordsRecallQuery(question, userId, limit);
  if (!query) return [];
  // MEDIUM 修复(2026-07-03 会审)：此前隐式依赖"同进程内其它路径已先 ensurePrimaryDbReady()"，
  // 冷启动/新调用路径下先跑到这里会直接抛 "no such table: archive_records"。显式确保 schema。
  await ensurePrimaryDbReady();
  const db = getDb();
  const res = await db.execute({ sql: query.sql, args: query.args });
  return res.rows.map((r) => {
    const parsed = safeJsonRecord(r.archive_json);
    const issue = isRecord(parsed.issue) ? parsed.issue : {};
    return {
      id: String(r.id),
      originalQuestion: typeof issue.question === 'string' ? issue.question : '',
      verdict: undefined,
      sourceLabel: undefined,
      createdAt: String(r.created_at),
      reusableLessons: Array.isArray(parsed.lessons) ? parsed.lessons.map(String) : [],
      retrospectiveStatus: typeof parsed.outcome === 'string' ? parsed.outcome : undefined,
    };
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function safeJsonRecord(v: unknown): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(String(v ?? '{}'));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeJsonArray(v: unknown): string[] {
  try {
    const a = JSON.parse(String(v ?? '[]'));
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}
