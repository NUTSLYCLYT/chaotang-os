/**
 * 工部 · 会审卡投影（断点B · 2026-07-06 · 一案穿堂 Phase 0）
 *
 * 让军机处会审里工部那张 RedBlueCard 由**真工部引擎 `evaluateTask`**（确定性纯函数）产出，
 * 替掉通用关键词 synth（synth 会对"PACK 能不能造"盲目拍 GREEN，是假的真卡）。
 *
 * 工部命门（铁律9）：前端**永不判真可行性**——`evaluateTask` 的 missing 恒含"真实可行性(需后端 PACK 蜂群)"，
 * 新案(未交付)恒不 approve → 恒不 GREEN。这正是 Deming 要的"先会说不知道，再说能造"。
 * 两入口一脑：工部页与军机处会审走同一个 evaluateTask（断言见 gongbu-ministry-card.nodetest.ts）。
 */
import { evaluateTask, type GongbuEvaluation, type GongbuTask } from './gongbu-engines';
import type { RedBlueCard, MinistrySignal } from '@/core/courtos/ministries/ministry-types';
import { signalToVerdict } from '@/core/courtos/ministries/red-blue-loop';
import type { SourceLabel, RiskLevel } from '@/core/courtos/types';

/** 军机处一个案子(rawQuestion) → 工部引擎输入。数字/产线值不臆造，交给引擎关键词分类。 */
export function caseToGongbuTask(taskId: string, rawQuestion: string): GongbuTask {
  const text = (rawQuestion ?? '').trim();
  return {
    id: taskId,
    taskId,
    title: text.slice(0, 60) || '（无题）',
    description: '',
    rawCommand: text,
    status: 'reviewing', // 军机处在审的案子非"已交付"→引擎不会误判 approve(GREEN)
    progressPct: 0,
  };
}

/**
 * 工部四裁决 → 会审灯号。
 * approve(已交付)→GREEN；amend(削MVP·真可行性需后端)→YELLOW；review(触产线/对外承诺·转后端)→GRAY(前端不判)；reject→RED。
 * 关键：新案永不 approve → 前端永不对"能不能造"拍 GREEN（Deming：先会说不知道）。
 */
export function gongbuVerdictToSignal(ev: GongbuEvaluation): MinistrySignal {
  switch (ev.verdict) {
    case 'approve':
      return 'GREEN';
    case 'reject':
      return 'RED';
    case 'review':
      return 'GRAY';
    case 'amend':
    default:
      return 'YELLOW';
  }
}

/**
 * 工部职责信号（硬件/交付/产线/工程）。用于会审侧的"本部适用吗"域门——
 * 对齐 LLM 版 real-ministry-card 的"本部不适用→GRAY弃权"（大神会审 Deming：off-domain 若落 amend→YELLOW，
 * 等于工部对纯营销/HR 案伪造"削MVP"越权立场，还被"真算"标签背书，比罐头更误导）。
 * ponytail: 粗域门，够挡掉明显 off-domain；升级路径同 Munger 会审——上游结构化 case 后按 domain 字段路由。
 */
const GONGBU_DOMAIN_RE =
  /造|制造|生产|硬件|PACK|电池|储能|交付|工程|产线|BOM|物料|器件|装配|良率|产能|工艺|模组|结构|样机|试产|质检|验收|设备|机械|嵌入式|固件/i;

export function gongbuEngineCard(taskId: string, rawQuestion: string, sourceLabel: SourceLabel = 'MIXED'): RedBlueCard {
  const text = (rawQuestion ?? '').trim();
  const ev = evaluateTask(caseToGongbuTask(taskId, rawQuestion));

  // 本部不适用 → GRAY 弃权：无工部职责信号，且引擎未探到产线锁/对外承诺 → 不评（绝不伪造越权黄卡）。
  const offDomain = !GONGBU_DOMAIN_RE.test(text) && ev.locks.length === 0 && ev.forbidden.length === 0;
  if (offDomain) {
    return {
      ministryId: 'works',
      taskId,
      mainThesis: '工部主手(A)：本案未见工部职责信号（硬件/交付/产线/PACK），本部不评。',
      mainPlan: '弃权',
      deputyChallenge: '工部副手(B)：越权表态比不表态更危险，本案交由主责部门。',
      deputyRisks: [],
      disputeFocus: '本部是否适用',
      synthesis: '本案不属工部职责范围，弃权。',
      ruling: '工部尚书裁断：弃权（本部不适用）',
      signal: 'GRAY',
      verdict: signalToVerdict('GRAY'),
      conditionsToProceed: [],
      missingEvidence: [],
      needsHumanConfirmation: false,
      riskLevel: 'low',
      sourceLabel,
      confidence: 0.3,
    };
  }

  const signal = gongbuVerdictToSignal(ev);
  const risks: string[] = [];
  if (ev.forbidden.length) risks.push(...ev.forbidden);
  if (ev.locks.length) risks.push(`产线资产上锁(转后端)：${ev.locks.join('、')}`);

  const riskLevel: RiskLevel = ev.forbidden.length ? 'high' : ev.locks.length ? 'medium' : 'low';

  return {
    ministryId: 'works',
    taskId,
    mainThesis: `工部主手(A)：${ev.explain.type}`,
    mainPlan: `${ev.verdictCn}。${ev.explain.verdict}`,
    deputyChallenge: `工部副手(B)：${ev.explain.locks}`,
    deputyRisks: risks,
    disputeFocus: '定性能不能造 vs 真实可行性(需后端兑现)',
    synthesis: ev.explain.verdict,
    ruling: `工部尚书裁断：${ev.verdictCn}`,
    signal,
    verdict: signalToVerdict(signal),
    conditionsToProceed: ev.missing.map((m) => `补：${m}`),
    missingEvidence: ev.missing,
    needsHumanConfirmation: ev.forbidden.length > 0,
    riskLevel,
    sourceLabel,
    confidence: signal === 'GREEN' ? 0.78 : signal === 'RED' ? 0.7 : signal === 'GRAY' ? 0.44 : 0.58,
  };
}
