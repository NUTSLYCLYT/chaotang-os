/**
 * 朝堂 OS · 丞相核心原语「御座的笔」(server-safe 纯函数,零副作用)
 *
 * 设计依据:dev/notes/chengxiang-design.md(5 大神一致)。
 * 丞相只动笔不动手——闸前(出"字")全自治、闸后(出"事")必有旨。本模块把三条铁规做成可测纯函数:
 *   1. classifyChancellorAction —— 笔/手 自治闸(字=consult 自动 / 事=execute 要旨,未知一律 fail-safe 归 execute)
 *   2. validateMandate          —— 拟旨三必填(自我反驳 steelman / 利益冲突 recusal / 期望结果回测账)
 *   3. applyRecusal             —— 涉太子徒弟编译期回避(weight=0 / role=recused,非降权)
 *
 * 本模块【不】执行、【不】写库、【不】调模型——它只判定"这一步该不该自动、这份拟旨合不合法"。
 * 真正的执行/派遣/碰产线由上游在拿到 requiresDecree=true 后走 有旨 + 人工门 + jiqun:8081(铁律①)。
 */

import type { RealityState } from '@/lib/reality/reality-state';

// ── 笔/手 自治闸 ───────────────────────────────────────────────────────────
// 闸前·纯认知(idempotent 可重放、零外部副作用) —— 丞相可无限制"想和说"。
export const CONSULT_ACTIONS = [
  'preview_draft', // /preview 拟旨预览
  'summon_review', // 召军机处会审
  'aggregate', // 确定性聚合分奏
  'estimate_roi', // callLLM 算 ROI / 机会成本
  'recall_memory', // 读 Hermes 旧案检索(只读)
  'list_gaps', // 列缺证清单
  'compose_memorial', // 合成奏折(八件套)
  'simulate', // 模拟推演
  'write_draft', // 写 DRAFT(非采纳态、不反写记忆)
] as const;

// 闸后·写逃逸到世界 —— 必须有旨 + 人工门 L0-L4,前端咨询引擎禁直连重型网关。
export const EXECUTE_ACTIONS = [
  'dispatch', // /dispatch 真派遣
  'openclaw_real_asset', // OpenClaw 碰真实资产
  'jiqun_production', // 转 jiqun:8081 产线
  'memory_accepted_writeback', // 记忆采纳态反写(铁律③)
  'submit_production_asset', // 提交真实产线资产(PACK/报价/BOM/交期/付款/对外承诺/供应商锁定)
  'irreversible', // 不可逆动作
] as const;

export type ConsultAction = (typeof CONSULT_ACTIONS)[number];
export type ExecuteAction = (typeof EXECUTE_ACTIONS)[number];
export type ChancellorActionKind = ConsultAction | ExecuteAction;

export interface ActionClassification {
  /** consult=闸前自治(纯认知) / execute=闸后必有旨 */
  mode: 'consult' | 'execute';
  /** 是否必须先有用户旨意才能做 */
  requiresDecree: boolean;
  /** 是否必须过人工确认门 L0-L4 */
  requiresManualGate: boolean;
  reason: string;
}

const CONSULT_SET: ReadonlySet<string> = new Set(CONSULT_ACTIONS);
const EXECUTE_SET: ReadonlySet<string> = new Set(EXECUTE_ACTIONS);

/**
 * 笔/手 判据:产出的是"字"还是"事"?可重放且零外部副作用→consult 自动;写逃逸到世界→execute 要旨。
 * fail-safe:未登记的动作一律按 execute 处理(宁可错判为要旨,不可错放出门),呼应"模糊归要旨"。
 */
export function classifyChancellorAction(kind: string): ActionClassification {
  if (CONSULT_SET.has(kind)) {
    return {
      mode: 'consult',
      requiresDecree: false,
      requiresManualGate: false,
      reason: `「${kind}」是纯认知(可重放·零外部副作用),闸前自治,无需旨`,
    };
  }
  const known = EXECUTE_SET.has(kind);
  return {
    mode: 'execute',
    requiresDecree: true,
    requiresManualGate: true,
    reason: known
      ? `「${kind}」写逃逸到世界(碰产线/不可逆),闸后必有旨 + 人工门`
      : `「${kind}」未登记,fail-safe 归 execute:必有旨 + 人工门(宁可错判为要旨)`,
  };
}

// ── 拟旨三必填 ─────────────────────────────────────────────────────────────
/** 涉徒回避结果:丞相审到自己保荐/监督过的太子→编译期 weight=0、role=recused(非降权)。 */
export interface RecusalState {
  /** 本案血缘是否含丞相保荐/监督过的太子 */
  involvesProtegeTaizi: boolean;
  /** 丞相在本案风控里的票权:涉徒=0(移出庭),否则仍是 0(丞相恒零票,见 CHANCELLOR_RISK_VOTE_WEIGHT) */
  weight: 0;
  role: 'chair' | 'recused';
  reason: string;
}

/** Drucker 期望结果回测账:到期从 reality-state 自动回测"说的=发生的"。 */
export interface ForecastAccount {
  /** 带日期的期望结果 */
  expectedResult: string;
  /** ISO 日期,到期回测 */
  byDate: string;
  /** 一条能证伪它的指标 */
  falsifyingMetric: string;
  /** "什么都不做会怎样"基线(放在"怎么做"之前) */
  doNothingBaseline: string;
}

/** 丞相拟旨/旨草案。三必填(steelman/recusal/forecast)缺任一在源头判无效。 */
export interface ChancellorMandate {
  /** 框定的问题(新颖×重大) */
  question: string;
  /** 推荐的旨草案文本 */
  draft: string;
  /** (a) 自我反驳位:为什么不该做的最强反方(steelman against itself) */
  steelmanAgainst: string;
  /** (b) 利益冲突位 */
  recusal: RecusalState;
  /** (c) 期望结果回测账 */
  forecast: ForecastAccount;
  /** 来源诚实(SSOT:reality-state) */
  source: RealityState;
}

export interface MandateValidation {
  valid: boolean;
  /** 缺失/不合法的必填项 */
  missing: string[];
}

const nonEmpty = (s: unknown): boolean => typeof s === 'string' && s.trim().length > 0;

/**
 * 校验拟旨三必填。确定性聚合器递交军机处【之前】调用,缺任一即拒,根本进不了会审。
 * 这把"框问题缺对抗"的唯一未堵单点,从源头用 schema 强制对冲掉。
 */
export function validateMandate(mandate: ChancellorMandate): MandateValidation {
  const missing: string[] = [];
  if (!nonEmpty(mandate.question)) missing.push('question');
  if (!nonEmpty(mandate.draft)) missing.push('draft');
  // (a) 自我反驳
  if (!nonEmpty(mandate.steelmanAgainst)) missing.push('steelmanAgainst(自我反驳位)');
  // (b) 利益冲突:涉徒必须已 recused,否则非法
  if (!mandate.recusal) {
    missing.push('recusal(利益冲突位)');
  } else if (mandate.recusal.involvesProtegeTaizi && mandate.recusal.role !== 'recused') {
    missing.push('recusal:涉太子案丞相必须 role=recused(不得自审徒弟)');
  }
  // (c) 期望结果回测账
  if (!mandate.forecast) {
    missing.push('forecast(期望结果回测账)');
  } else {
    if (!nonEmpty(mandate.forecast.expectedResult)) missing.push('forecast.expectedResult');
    if (!nonEmpty(mandate.forecast.byDate)) missing.push('forecast.byDate');
    if (!nonEmpty(mandate.forecast.falsifyingMetric)) missing.push('forecast.falsifyingMetric');
  }
  return { valid: missing.length === 0, missing };
}

/**
 * 涉徒回避(编译期、非降权):本案血缘含丞相保荐/监督过的太子→丞相整个移出庭,御史中丞代行主持。
 * 回避是结构强制,不靠自觉。
 */
export function applyRecusal(involvesProtegeTaizi: boolean): RecusalState {
  return involvesProtegeTaizi
    ? {
        involvesProtegeTaizi: true,
        weight: 0,
        role: 'recused',
        reason: '本案血缘含丞相保荐/监督过的太子,强制回避(weight=0,御史中丞代行主持)',
      }
    : {
        involvesProtegeTaizi: false,
        weight: 0,
        role: 'chair',
        reason: '丞相主持但恒零票(保荐≠裁决);风控 tally 全在三司 + 用户',
      };
}

/** 丞相在风控 tally 里的票权恒为 0 —— 它是举证的运动员,从不是落锤的裁判。 */
export const CHANCELLOR_RISK_VOTE_WEIGHT = 0 as const;
