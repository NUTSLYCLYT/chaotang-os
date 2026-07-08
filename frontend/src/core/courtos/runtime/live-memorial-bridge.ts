/**
 * 飞轮点火桥（2026-07-02 · 会审正确版）—— 把 demo 页独享的 C 栈真闭环,接到主 UI 的 confirm-edict。
 *
 * 复用 `/api/court/decision/route.ts` 已验证的真闭环(refine 真丞相 LLM → 户/刑/工真 agent 会审
 * → 御史台 → 圣旨合成),把结果**全量重建**进主 UI 的 memorial(纯构建层 live-memorial-build.ts)。
 *
 * 诚实(铁律9/13.2.3):
 *   - LIVE/MIXED 均诚实重建 memorial(全字段统一标该源、可召回);仅 FALLBACK/DEMO 原样返回启发式 base。
 *   - live 布尔只在整链全真(LIVE/LIVE_SWARM)为 true;MIXED 标 MIXED、live=false,但奏折照样重建+沉淀。
 *   - 重建后 memorial 全部 source_label === finalSource(不变量,见 buildLiveMemorial)。
 *
 * 幂等(会审 CRITICAL 修正):confirm 步**只召回、不归档**。归档留给 decision(adopt)那步
 * (tasks/[taskId]/decision/route.ts 已 id=archive_id 写入),避免双主键写同一 case 污染召回池。
 * 本文件**不得**引用史馆写入 API(回归断言 live-memorial-bridge.nodetest.ts 静态扫描钉死)。
 *
 * 不碰 6029 行承重墙 ShangshufangPage,不碰并发在改的 local-decision-loop.ts。
 */
import 'server-only';
import { logger } from '@/lib/logger';
import { makeRefineExecutor, makeReportExecutor } from '@/core/courtos/executors/llm-executor';
import {
  createDraftTask,
  refineIntent,
  checkEvidence,
  startReviewAndReport,
} from './courtos-runtime.ts';
import { runMinistryReview } from '../ministries/ministry-review-loop.ts';
import { runMinistryReviewWithRealAgents } from '../ministries/real-ministry-review.ts';
import { runYushitaiAudit } from '../ministries/yushitai-auditor.ts';
import { synthesizeImperialReport } from '../ministries/imperial-report-synthesizer.ts';
import { findSimilarCourtArchives, type PriorCase } from '../archive/archive-store.ts';
import { mergeHonestSource } from '@/lib/reality/merge-source';
import { buildLiveMemorial, computeLiveFlag, isRecallableSource, reconcileLiveDecision } from './live-memorial-build.ts';
import type { ShangshufangReviewMemorial, ShangshufangSourceLabel } from '@/lib/jiqun-api';

export interface LiveMemorialResult {
  memorial: ShangshufangReviewMemorial;
  /** 史馆召回的同类真旧案(复利);点不点亮都带上。 */
  priorCases: PriorCase[];
  /** 是否真出 LIVE(整链真)。UI/日志诚实展示用,不是给假标。 */
  live: boolean;
  /** 真实 review 源(可能 MIXED/FALLBACK);诚实日志用。live=false 时 memorial 仍是 base 的自洽信封。 */
  reviewSource: ShangshufangSourceLabel;
}

/**
 * 决策飞轮读回路(2026-07-03 修)：把召回的 PriorCase 压成一行纯文本摘要，供 courtos-runtime.ts
 * 的 prompt 拼接(该文件零 server-only 依赖，不能直接 import PriorCase 的重类型，只吃 string[])。
 * 只带问题原文+裁决+可复用教训，不带 archive id/source_label 等内部字段(prompt 不需要，也不该暴露)。
 */
function summarizePriorCase(pc: PriorCase): string {
  const parts = [pc.originalQuestion];
  if (pc.verdict) parts.push(`裁决:${pc.verdict}`);
  if (pc.reusableLessons.length > 0) parts.push(`教训:${pc.reusableLessons.join('；')}`);
  return parts.join(' | ');
}

/**
 * 用 C 栈真闭环点亮 memorial + 接飞轮召回。哑火/降级/异常 → 原样返回 baseMemorial(诚实 FALLBACK)。
 */
export async function igniteLiveMemorial(params: {
  taskId: string;
  question: string;
  userId: string;
  baseMemorial: ShangshufangReviewMemorial;
  requestId?: string;
  /**
   * 锦衣卫采证摘要(retrieveContext 召回)。仅拼进会审输入 originalQuestion 让户部据情报核算，
   * 不进召回/归档问题(question 保持干净，防飞轮召回漂移)。空则不拼(诚实缺证由采证段呈现)。
   */
  intelContext?: string;
}): Promise<LiveMemorialResult> {
  const { taskId, question, userId, baseMemorial, requestId, intelContext } = params;
  const log = logger.child({ requestId: requestId ?? crypto.randomUUID(), userId });

  // 飞轮召回(只召回不归档,幂等):失败不影响决策(规则7)。
  let priorCases: PriorCase[] = [];
  try {
    priorCases = await findSimilarCourtArchives(question, userId);
  } catch (recallErr) {
    log.warn('[live-memorial-bridge] 史馆召回失败(不影响决策返回)', {
      err: recallErr instanceof Error ? recallErr.message : String(recallErr),
    });
  }

  try {
    // 决策飞轮读回路(2026-07-03 修)：此前召回只用于 UI 展示，从未进入驱动 LLM 的 prompt——
    // 复利决策"只写不读"。这里把 priorCases 转成纯文本摘要，真正喂进拟旨/会审的 prompt。
    const priorCaseNotes = priorCases.map(summarizePriorCase);
    let task = createDraftTask(taskId, question, priorCaseNotes);
    task = await refineIntent(task, makeRefineExecutor(requestId));
    task = checkEvidence(task, []);
    task = await startReviewAndReport(task, makeReportExecutor(requestId));

    // 外层门(拟旨 + 奏折):任一步降级则整体不真。此处早退可省下 3 次会审 LLM(丞相已哑火就别再烧钱)。
    const outerSource = mergeHonestSource([task.refineSourceLabel, task.report?.sourceLabel]) as ShangshufangSourceLabel;
    // 纯 FALLBACK/DEMO(拟旨+奏折全哑火)才早退省会审 LLM;MIXED(部分真)继续,让它诚实沉淀。
    if (!isRecallableSource(outerSource)) {
      log.info('[live-memorial-bridge] 拟旨/奏折全降级,跳过会审,保留启发式奏折', { outerSource });
      return { memorial: baseMemorial, priorCases, live: false, reviewSource: outerSource };
    }

    const realAgentsOff = process.env.COURT_REAL_MINISTRY_AGENTS === '0';
    const reviewInput = {
      taskId,
      // 户部据锦衣卫采证核算：把采证摘要垫进会审问题(不改召回用的 question)。
      originalQuestion: intelContext ? `${question}\n\n${intelContext}` : question,
      refinedIntent: task.refinedIntent,
      sourceLabel: outerSource,
    };
    // 真 agent 部门:户部(finance)/刑部(justice)/工部(works)——高判错代价部;其余 heuristic 省 token。
    const ministryReview = realAgentsOff
      ? runMinistryReview(reviewInput)
      : await runMinistryReviewWithRealAgents(reviewInput, ['finance', 'justice', 'works']);

    // 诚实再门控(会审 CRITICAL 修正):把会审源标折进最终判定。某部超时回退 heuristic(卡 FALLBACK)
    // 或 selector 选中非真部 → ministryReview.sourceLabel 降级 → finalSource 非 LIVE → 不点亮,回退启发式。
    // 绝不把 heuristic 卡强戳 LIVE(上一版 BLOCK 的"盖真章")。
    // 三源合并(拟旨+奏折+会审);纯 FALLBACK/DEMO 才回退启发式,MIXED 诚实重建。
    const { finalSource } = reconcileLiveDecision(
      task.refineSourceLabel,
      task.report?.sourceLabel,
      ministryReview.sourceLabel,
    );
    if (!isRecallableSource(finalSource)) {
      log.info('[live-memorial-bridge] 会审全降级(FALLBACK/DEMO),保留启发式奏折', {
        finalSource,
        ministrySource: ministryReview.sourceLabel,
      });
      return { memorial: baseMemorial, priorCases, live: false, reviewSource: finalSource };
    }

    const yushitai = runYushitaiAudit({
      review: ministryReview,
      draftVerdict: task.report?.verdict,
      draftSourceLabel: finalSource,
    });
    const imperialReport = synthesizeImperialReport({ review: ministryReview, audit: yushitai });
    const needsHumanConfirmation =
      Boolean(task.report?.needsHumanConfirmation) || imperialReport.needsHumanConfirmation;

    // 全量重建诚实信封(全部 source_label === finalSource;LIVE 或 MIXED,统一戳平)。
    const memorial = buildLiveMemorial(baseMemorial, {
      reviewSource: finalSource,
      refinedIntent: task.refinedIntent ?? question,
      ministryReview,
      imperialReport,
      needsHumanConfirmation,
    });
    // live 只在整链全真(LIVE/LIVE_SWARM)为 true;MIXED 奏折照样重建+可召回,但诚实标 MIXED、live=false。
    const live = computeLiveFlag(finalSource);
    log.info(live ? '[live-memorial-bridge] 点亮真奏折(LIVE)' : '[live-memorial-bridge] 混合来源奏折(MIXED·诚实沉淀)', {
      finalSource,
      verdict: imperialReport.verdict,
      ministrySignal: ministryReview.overallSignal,
    });
    return { memorial, priorCases, live, reviewSource: finalSource };
  } catch (err) {
    // 整体异常 → 诚实回退启发式,绝不假标 LIVE。priorCases 仍带上(召回已在 try 外完成)。
    log.warn('[live-memorial-bridge] 点火失败,诚实回退启发式', {
      err: err instanceof Error ? err.message : String(err),
    });
    return { memorial: baseMemorial, priorCases, live: false, reviewSource: 'FALLBACK' };
  }
}
