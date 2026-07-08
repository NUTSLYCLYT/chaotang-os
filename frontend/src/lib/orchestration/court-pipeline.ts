/**
 * 朝堂 OS · Orchestration · 三省审议流水线
 *
 * runCourtPipeline() 是一个 async generator，按 5 阶段 yield PipelineEvent：
 *   1. retrieve   并行 Tavily 情报 + Turso 向量召回
 *   2. zhongshu   中书省起草（agentic tool-use loop）
 *   3. menxia     门下省 LLM 驳议（不再规则引擎）
 *   4. shangshu   尚书省 create_ministry_task 落地（仅准奏时）
 *   5. persist    决议入 decisions 表
 *
 * 消费方（route handler）逐个 yield 转成 SSE event 推给前端。
 *
 * 失败策略：
 *   - 每阶段独立 try/catch，单阶段失败 yield stage_error 但尽量不中断后续可降级阶段
 *   - 检索失败已在 retrieveContext 内部降级；本层只兜底致命错误
 */

import { logger } from '@/lib/logger';
import { ensurePrimaryDbReady, updatePrimaryTaskResult, upsertPrimaryTask } from '@/lib/db/primary-store';
import {
  retrieveContext,
  runZhongshu,
  runMenxia,
  runShangshu,
  type Constitution,
  type DeliberationResult,
  type MenxiaReview,
  type RetrievedContext,
  type ShangshuExecution,
  type ZhongshuDraft,
} from '@/features/governance/lib/three-chamber-engine';

/* ==========================================================================
 * Pipeline 事件
 * ========================================================================== */

export type PipelineStage =
  | 'retrieve'
  | 'zhongshu'
  | 'menxia'
  | 'shangshu'
  | 'persist';

export type PipelineEvent =
  | { type: 'stage_start'; stage: PipelineStage; at: string }
  | { type: 'stage_progress'; stage: PipelineStage; message: string; at: string }
  | {
      type: 'retrieve_done';
      stage: 'retrieve';
      tavilyCitations: number;
      precedents: number;
      context: RetrievedContext;
      at: string;
    }
  | { type: 'zhongshu_done'; stage: 'zhongshu'; draft: ZhongshuDraft; rounds: number; at: string }
  | { type: 'menxia_done'; stage: 'menxia'; review: MenxiaReview; at: string }
  | {
      type: 'shangshu_done';
      stage: 'shangshu';
      execution: ShangshuExecution;
      rounds: number;
      at: string;
    }
  | { type: 'shangshu_skipped'; stage: 'shangshu'; reason: string; at: string }
  | { type: 'persist_done'; stage: 'persist'; decisionId: string; taskId: string; at: string }
  | { type: 'stage_error'; stage: PipelineStage; error: string; at: string }
  | {
      type: 'pipeline_telemetry';
      metrics: {
        commandLength: number;
        stageLatencies: Record<string, number>;
        grounded: boolean;
        citationCount: number;
        precedentCount: number;
        swarmDispatched: boolean;
        swarmDegraded: boolean;
        totalMs: number;
        sessionId: string;
      };
      at: string;
    }
  | { type: 'pipeline_done'; result: DeliberationResult; at: string };

export interface RunPipelineParams {
  command: string;
  constitutions?: Constitution[];
  sessionId?: string;
  taskId?: string;
  petitionId?: string;
  requestId: string;
  userId?: string;
  authToken?: string;
}

function now(): string {
  return new Date().toISOString();
}

/* ==========================================================================
 * 主流水线
 * ========================================================================== */

export async function* runCourtPipeline(
  params: RunPipelineParams,
): AsyncGenerator<PipelineEvent, void, unknown> {
  const { command, requestId } = params;
  const userId = params.userId ?? 'system';
  const constitutions = params.constitutions ?? [];
  const sessionId = params.sessionId ?? `del_${Date.now()}`;
  const log = logger.child({ requestId, userId });
  const t0 = Date.now();
  const stageTimings: Record<string, number> = {};
  let _stageT = t0;

  /* ---- 阶段 1：检索 ---- */
  yield { type: 'stage_start', stage: 'retrieve', at: now() };
  _stageT = Date.now();
  let ctx: RetrievedContext = { tavilyCitations: [], intelSummary: '', precedents: [], lessons: [] };
  try {
    ctx = await retrieveContext(command, requestId);
    yield {
      type: 'retrieve_done',
      stage: 'retrieve',
      tavilyCitations: ctx.tavilyCitations.length,
      precedents: ctx.precedents.length,
      context: ctx,
      at: now(),
    };
    stageTimings['retrieve'] = Date.now() - _stageT;
  } catch (err) {
    yield { type: 'stage_error', stage: 'retrieve', error: errMsg(err), at: now() };
  }

  /* ---- 阶段 2：中书省起草（agentic loop）---- */
  yield { type: 'stage_start', stage: 'zhongshu', at: now() };
  _stageT = Date.now();
  let draft: ZhongshuDraft;
  try {
    const { draft: d, agentic } = await runZhongshu(command, ctx, requestId, userId);
    draft = d;
    yield {
      type: 'zhongshu_done',
      stage: 'zhongshu',
      draft,
      rounds: agentic.rounds,
      at: now(),
    };
    stageTimings['zhongshu'] = Date.now() - _stageT;
  } catch (err) {
    yield { type: 'stage_error', stage: 'zhongshu', error: errMsg(err), at: now() };
    draft = {
      draft: `就「${command.slice(0, 60)}」一事 · 中书省起草失败 · 待复议`,
      benefits: [],
      concerns: ['中书省 LLM 调用失败'],
      affectedDepts: [],
      citations: [],
    };
  }

  /* ---- 阶段 3：门下省驳议（LLM）---- */
  yield { type: 'stage_start', stage: 'menxia', at: now() };
  _stageT = Date.now();
  let menxia: MenxiaReview;
  try {
    const { review } = await runMenxia(command, draft, constitutions, ctx, requestId, userId);
    menxia = review;
    yield { type: 'menxia_done', stage: 'menxia', review: menxia, at: now() };
    stageTimings['menxia'] = Date.now() - _stageT;
  } catch (err) {
    yield { type: 'stage_error', stage: 'menxia', error: errMsg(err), at: now() };
    // 门下失败 · 保守判再议，绝不放行
    menxia = {
      verdict: '再议',
      reasoning: `门下省 LLM 调用失败，保守判再议：${errMsg(err)}`,
      violatedConstitutions: [],
      precedents: [],
      suggestedEdits: ['门下省不可达，请人工复核'],
    };
  }

  /* ---- 阶段 4：尚书省落地（仅准奏）---- */
  let shangshu: ShangshuExecution | undefined;
  if (menxia.verdict === '准') {
    yield { type: 'stage_start', stage: 'shangshu', at: now() };
    _stageT = Date.now();
    try {
      const { execution, agentic } = await runShangshu(command, draft, requestId, userId, params.authToken);
      shangshu = execution;
      yield {
        type: 'shangshu_done',
        stage: 'shangshu',
        execution,
        rounds: agentic.rounds,
        at: now(),
      };
      stageTimings['shangshu'] = Date.now() - _stageT;
    } catch (err) {
      yield { type: 'stage_error', stage: 'shangshu', error: errMsg(err), at: now() };
    }
  } else {
    yield {
      type: 'shangshu_skipped',
      stage: 'shangshu',
      reason: `门下判「${menxia.verdict}」· 未准奏，不落地`,
      at: now(),
    };
    stageTimings['shangshu'] = Date.now() - _stageT;
  }

  /* ---- 组装结果 ---- */
  const result: DeliberationResult = {
    sessionId,
    timestamp: now(),
    originalCommand: command,
    zhongshu: draft,
    menxia,
    shangshu,
    finalVerdict: menxia.verdict,
    totalMs: Date.now() - t0,
  };

  /* ---- 阶段 5：入库 decisions ---- */
  yield { type: 'stage_start', stage: 'persist', at: now() };
  _stageT = Date.now();
  try {
    const persisted = await persistDecision(result, params, ctx);
    yield { type: 'persist_done', stage: 'persist', decisionId: persisted.decisionId, taskId: persisted.taskId, at: now() };
    stageTimings['persist'] = Date.now() - _stageT;
  } catch (err) {
    yield { type: 'stage_error', stage: 'persist', error: errMsg(err), at: now() };
  }

  log.info('court pipeline done', {
    verdict: result.finalVerdict,
    ms: result.totalMs,
    hasShangshu: !!shangshu,
  });

  const _swarmDegraded = shangshu?.dispatchedTo?.[0] === '__degraded__';
  const _swarmDispatched = !!shangshu && !_swarmDegraded;
  yield {
    type: 'pipeline_telemetry' as const,
    metrics: {
      commandLength: command.length,
      stageLatencies: stageTimings,
      grounded: ctx.tavilyCitations.length > 0 || ctx.precedents.length > 0,
      citationCount: ctx.tavilyCitations.length,
      precedentCount: ctx.precedents.length,
      swarmDispatched: _swarmDispatched,
      swarmDegraded: _swarmDegraded,
      totalMs: Date.now() - t0,
      sessionId,
    },
    at: now(),
  };

  yield { type: 'pipeline_done', result, at: now() };

  log.info('pipeline_telemetry', {
    commandLength: command.length,
    grounded: ctx.tavilyCitations.length > 0 || ctx.precedents.length > 0,
    citationCount: ctx.tavilyCitations.length,
    swarmDispatched: _swarmDispatched,
    swarmDegraded: _swarmDegraded,
    totalMs: Date.now() - t0,
    sessionId,
    userId,
  });
}

/* ==========================================================================
 * 第五步 · 决议入库
 * ========================================================================== */

async function persistDecision(
  result: DeliberationResult,
  params: RunPipelineParams,
  ctx: RetrievedContext,
): Promise<{ decisionId: string; taskId: string }> {
  const db = await ensurePrimaryDbReady();
  const id = `dec_${crypto.randomUUID()}`;
  const finalStatus =
    result.finalVerdict === '准' &&
    result.shangshu &&
    result.shangshu.dispatchedTo[0] !== '__degraded__'
      ? 'running'
      : 'report_ready';

  const task = await upsertPrimaryTask({
    taskId: params.taskId,
    command: result.originalCommand,
    status: finalStatus,
    mode: 'hybrid',
    result: {
      summary: result.zhongshu.draft || result.menxia.reasoning || result.originalCommand,
      conclusion: result.finalVerdict,
      sessionId: result.sessionId,
      source: 'orchestration_pipeline',
      stage: 'decision_pending',
    },
    at: result.timestamp,
  });

  const citationsJson = JSON.stringify({
    tavily: ctx.tavilyCitations,
    precedents: ctx.precedents,
  });

  await db.execute({
    sql: `
      INSERT INTO decisions (
        id, task_id, petition_id,
        zhongshu_json, menxia_json, shangshu_json,
        final_decision, citations_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      task.taskId,
      params.petitionId ?? null,
      JSON.stringify(result.zhongshu),
      JSON.stringify(result.menxia),
      result.shangshu ? JSON.stringify(result.shangshu) : null,
      result.finalVerdict,
      citationsJson,
      result.timestamp,
    ],
  });

  await updatePrimaryTaskResult(
    task.taskId,
    finalStatus,
    {
      summary: result.zhongshu.draft || result.menxia.reasoning || result.originalCommand,
      conclusion: result.finalVerdict,
      decisionId: id,
      sessionId: result.sessionId,
      source: 'orchestration_pipeline',
      shangshu: result.shangshu ?? null,
      totalMs: result.totalMs,
    },
    result.timestamp,
  );

  return { decisionId: id, taskId: task.taskId };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
