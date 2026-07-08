/**
 * 真·部门红蓝卡（2026-06-24 · 缺口#3 · 把规则蜂群打穿成真 agent / 价值解锁）。
 *
 * 该部经真 LLM(callLLM,含三层 fallback)做红蓝对抗推理,产出真 RedBlueCard:
 *   - LLM 命中 live 且非网关离线兜底 → sourceLabel=LIVE(真推理,诚实)。
 *   - LLM 失败/超时/兜底/解析失败 → 回退确定性 runRedBlueLoop(sourceLabel=FALLBACK,诚实)。
 * 绝不把离线兜底标 LIVE(铁律3 / 缺口#2 同源诚实)。server-only(callLLM 命中 providers/预算/治理)。
 */
import 'server-only';
import { callLLM } from '@/lib/llm/router';
import { logger } from '@/lib/logger';
import { MINISTRY_REGISTRY } from './ministry-registry';
import { runRedBlueLoop, signalToVerdict } from './red-blue-loop';
import type { RedBlueInput } from './red-blue-loop';
import type { RedBlueCard, MinistrySignal } from './ministry-types';
import type { RiskLevel } from '../types';

const PROVIDER_TIMEOUT_MS = 16_000;

// 网关离线兜底标记(同 llm-executor):命中即降级,绝不当 LIVE。
const FALLBACK_MARKERS = ['离线模式', '兜底回复', '上游不可用', '暂时无法', '稍后重试', '全线不通'];

interface LlmCard {
  signal: MinistrySignal;
  thesis: string;
  plan: string;
  challenge: string;
  risks: string[];
  disputeFocus: string;
  synthesis: string;
  ruling: string;
  conditions: string[];
  missing: string[];
  riskLevel: RiskLevel;
  needsHumanConfirmation: boolean;
}

const SIGNALS: MinistrySignal[] = ['RED', 'YELLOW', 'GREEN', 'GRAY'];
const RISKS: RiskLevel[] = ['low', 'medium', 'high'];

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('no json object');
  return JSON.parse(raw.slice(start, end + 1));
}

function coerceCard(obj: unknown): LlmCard {
  const o = obj as Record<string, unknown>;
  const signal = SIGNALS.includes(o.signal as MinistrySignal) ? (o.signal as MinistrySignal) : 'YELLOW';
  const riskLevel = RISKS.includes(o.riskLevel as RiskLevel) ? (o.riskLevel as RiskLevel) : 'medium';
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : []);
  const str = (v: unknown, fb: string): string => (typeof v === 'string' && v.trim() ? v.trim() : fb);
  return {
    signal,
    thesis: str(o.thesis, '从本部职责看，本案存在可推进价值。'),
    plan: str(o.plan, '按本部职责给出推进路径，待证据校验。'),
    challenge: str(o.challenge, '需先消解风险/补证再推进。'),
    risks: arr(o.risks),
    disputeFocus: str(o.disputeFocus, '推进价值 vs 证据/风险充分性'),
    synthesis: str(o.synthesis, '综合 A/B 后形成裁断。'),
    ruling: str(o.ruling, signal === 'RED' ? '暂不放行' : signal === 'GREEN' ? '可放行' : '有条件/补证后放行'),
    conditions: arr(o.conditions),
    missing: arr(o.missing),
    riskLevel,
    needsHumanConfirmation: o.needsHumanConfirmation === true || signal === 'RED',
  };
}

/** 真 LLM 部门红蓝卡;任何失败回退确定性 heuristic(诚实标 FALLBACK)。 */
export async function runRealMinistryCard(input: RedBlueInput): Promise<RedBlueCard> {
  const meta = MINISTRY_REGISTRY[input.ministryId];
  const heuristicFallback = () => runRedBlueLoop(input);

  const mustCheckBlock = meta.mustCheckGaps?.length
    ? [
        '【本部必查清单(评测驱动，2026-07-03)】以下几项本部每次审议都不能漏问——若原始问题未提供，',
        '  必须原样或改写后放进 missing(缺证)，不得因为篇幅已经列了很多其它缺证就省略这几项：',
        ...meta.mustCheckGaps.map((g) => `  - ${g}`),
      ].join('\n')
    : null;

  const system = [
    `你是朝堂「${meta.nameCn}」尚书，只从本部职责视角(${meta.mission})做红蓝对抗审议。`,
    '不诊断越权、不替其他部门表态。必须务实、可执行、点出真实缺证与风险。',
    '【本部不适用 → 必须 GRAY】若本案不属于本部职责范围(如工部遇纯营销预算、刑部遇无合同/无对外承诺的内部小额事项)，',
    '  signal 一律 GRAY，challenge 写明"本案不涉及本部职责，本部不评/弃权"。**严禁为了表态而强行挑刺或越权判红。**',
    '【RED 极克制】RED 只用于**本部职责内的真红旗**:本部领域的不可逆后果 / 法律责任 / 现金断裂 / 确定不可行。',
    '  仅"我有疑虑/数字偏乐观/需要更多信息" → 用 YELLOW(有条件,提质疑)或 GRAY(信息不足);**绝不用 RED 表达"我不确定"。**',
    ...(mustCheckBlock ? [mustCheckBlock] : []),
    '只输出一个 JSON 对象(不要解释、不要 markdown 围栏外的字)，字段:',
    '{ "signal": "RED|YELLOW|GREEN|GRAY", "thesis": "主手推进主张", "plan": "推进方案",',
    ' "challenge": "副手挑战", "risks": ["风险"], "disputeFocus": "争议焦点", "synthesis": "综合",',
    ' "ruling": "尚书裁断", "conditions": ["推进条件"], "missing": ["缺证"],',
    ' "riskLevel": "low|medium|high", "needsHumanConfirmation": true|false }',
    'signal 含义: RED=本部真红旗不可放行 / YELLOW=有条件或有质疑 / GREEN=本部视角可放行 / GRAY=信息不足或本部不适用。涉及不可逆/重大付款/法律责任时 needsHumanConfirmation=true。',
  ].join('\n');

  const prompt = [input.text].filter(Boolean).join('\n').slice(0, 2000) || '(无具体事项)';

  try {
    const res = await callLLM(
      {
        intent: `courtos.ministry.${input.ministryId}.redblue`,
        requires: ['chinese_native'],
        prefers: ['reasoning'],
        estimatedInputTokens: 900,
      },
      prompt,
      { requestId: input.taskId, system, timeoutMs: PROVIDER_TIMEOUT_MS },
    );

    const text = typeof res.data === 'string' ? res.data : String(res.data ?? '');
    const isFallback = res.upstream !== 'live' || FALLBACK_MARKERS.some((m) => text.includes(m));
    if (isFallback) {
      // 诚实降级可见(charity-majors):区分"上游非 live"与后续解析失败,不静默。
      logger.warn('[real-ministry-card] LLM 非 live,回退 heuristic', {
        ministryId: input.ministryId,
        taskId: input.taskId,
        upstream: res.upstream,
      });
      return heuristicFallback();
    }

    const card = coerceCard(extractJson(text));
    const confidence = card.signal === 'GREEN' ? 0.82 : card.signal === 'YELLOW' ? 0.6 : card.signal === 'GRAY' ? 0.42 : 0.66;
    return {
      ministryId: input.ministryId,
      taskId: input.taskId,
      mainThesis: `${meta.nameCn}主手(A)：${card.thesis}`,
      mainPlan: card.plan,
      deputyChallenge: `${meta.nameCn}副手(B)：${card.challenge}`,
      deputyRisks: card.risks,
      disputeFocus: card.disputeFocus,
      synthesis: card.synthesis,
      ruling: `${meta.nameCn}尚书裁断：${card.ruling}`,
      signal: card.signal,
      verdict: signalToVerdict(card.signal),
      conditionsToProceed: card.conditions,
      missingEvidence: card.missing,
      needsHumanConfirmation: card.needsHumanConfirmation,
      riskLevel: card.riskLevel,
      sourceLabel: 'LIVE', // 真 LLM 推理且非兜底 → 诚实 LIVE
      confidence,
    };
  } catch (err) {
    // 解析失败/异常也不静默,留 telemetry 区分"LLM 返回不可解析"与"LLM down"。
    logger.warn('[real-ministry-card] LLM 解析/调用异常,回退 heuristic', {
      ministryId: input.ministryId,
      taskId: input.taskId,
      err: String(err),
    });
    return heuristicFallback();
  }
}
