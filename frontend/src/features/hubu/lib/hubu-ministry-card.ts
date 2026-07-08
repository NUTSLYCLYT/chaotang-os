/**
 * 户部 · 会审卡投影（断点B · 2026-07-06 · 一案穿堂 Phase 0）
 *
 * 让「军机处会审」里的户部那张 RedBlueCard 由**真户部引擎 `evaluateProject`**（确定性纯函数）产出，
 * 而不是通用关键词 synth（`runRedBlueLoop`）。这是「两个入口一个大脑」在会审侧的落地：
 *   - 户部页手动算 → evaluateProject
 *   - 军机处派给户部会审 → 本文件 hubuEngineCard → 同一个 evaluateProject
 * 两个入口永远吐同一个数（断言见 hubu-ministry-card.nodetest.ts）。
 *
 * 依赖方向（铁律6）：会审侧 import 户部引擎；户部引擎不反向依赖会审。本文件纯函数、无 server-only，
 * 可前端 import（军机处是 client 组件）。诚实标：前端确定性咨询 + 真 taskId = MIXED（本仓既有约定）。
 */
import { evaluateProject, type HubuEvaluation } from './hubu-engines';
import type { HubuProject } from '@/lib/contracts/hubu';
import type { RedBlueCard, MinistrySignal } from '@/core/courtos/ministries/ministry-types';
import { signalToVerdict } from '@/core/courtos/ministries/red-blue-loop';
import type { SourceLabel, RiskLevel } from '@/core/courtos/types';

/**
 * 把军机处的一个案子（rawQuestion 文本）转成户部引擎输入。
 * ponytail: 数字抽取直接复用引擎自带的 parseWan/parseRoiMultiple —— 把整段文本喂进 budget/roi 字段，
 * 引擎正则自会挑出「50万」「3x」「22%」。抽不到 → 字段落 '—' → parseWan/parseRoiMultiple 返 null
 * → evaluateProject 天然落 hold(缺证)，**绝不臆造**（Deming）。升级路径：需要更准的字段级抽取时，
 * 换成显式 NER，但那要连表单一起改，先不做。
 */
export function caseToHubuProject(rawQuestion: string): HubuProject {
  const text = (rawQuestion ?? '').trim();
  return {
    id: '',
    title: text.slice(0, 60) || '（无题）',
    target_dept: '',
    owner_dept: 'finance',
    status: 'pending_review',
    // 整段喂进 budget/roi，靠引擎正则挑「50万」「3x」；无数字则返 null → hold(缺证)。
    requested_budget: text || '—',
    estimated_roi: text || '—',
    payback_window: '—',
    // 现金流不从整段文本臆造(否则引擎误判"现金信息已提供")——诚实标未知，缺证由引擎显性列出(Deming)。
    cash_flow_pressure: '—',
    priority: 'P1',
    risk_level: 'medium',
    recommendation: '',
    command: text,
    acceptance_criteria: [],
    created_at: '',
    updated_at: '',
  };
}

/** 户部四裁决 → 会审灯号。缺核心数据(grounded=0)的 hold → GRAY(信息不足)，非 GREEN/RED（不臆造）。 */
export function hubuVerdictToSignal(ev: HubuEvaluation): MinistrySignal {
  switch (ev.verdict) {
    case 'approve':
      return 'GREEN';
    case 'adjust':
      return 'YELLOW';
    case 'reject':
      return 'RED';
    case 'hold':
    default:
      return ev.quality.grounded === 0 ? 'GRAY' : 'YELLOW';
  }
}

function exposureToRisk(exposure: number | null): RiskLevel {
  if (exposure === null) return 'medium';
  if (exposure >= 70) return 'high';
  if (exposure >= 40) return 'medium';
  return 'low';
}

/**
 * 户部引擎版会审卡：由 evaluateProject 直算，全字段 grounded 在真数字上。
 * 供 runMinistryReview 的 cardOverrides.finance 注入。
 */
export function hubuEngineCard(taskId: string, rawQuestion: string, sourceLabel: SourceLabel = 'MIXED'): RedBlueCard {
  const project = caseToHubuProject(rawQuestion);
  const ev = evaluateProject(project);
  const signal = hubuVerdictToSignal(ev);

  const risks: string[] = [];
  if (ev.cashNote) risks.push(ev.cashNote);
  if (ev.oneWayDoor.oneWay) risks.push(`单向门：${ev.oneWayDoor.reasons.join('、')}`);

  return {
    ministryId: 'finance',
    taskId,
    mainThesis: `户部主手(A)：${ev.explain.verdict}`,
    mainPlan: `${ev.verdictCn}。${ev.explain.score}`,
    deputyChallenge: `户部副手(B)：${
      ev.missing.length ? `缺${ev.missing.join('、')}，先补证` : ev.cashNote ?? '按评分推进，留意敞口'
    }`,
    deputyRisks: risks,
    disputeFocus: 'ROI/风险敞口 vs 缺证',
    synthesis: `${ev.explain.roi}；${ev.explain.exposure}`,
    ruling: `户部尚书裁断：${ev.verdictCn}`,
    signal,
    verdict: signalToVerdict(signal),
    conditionsToProceed: ev.missing.map((m) => `补：${m}`),
    missingEvidence: ev.missing,
    needsHumanConfirmation: ev.oneWayDoor.oneWay || ev.cashStress,
    riskLevel: exposureToRisk(ev.exposure),
    sourceLabel,
    confidence: signal === 'GREEN' ? 0.8 : signal === 'RED' ? 0.72 : signal === 'GRAY' ? 0.4 : 0.6,
  };
}
