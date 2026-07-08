/**
 * 朝堂 OS · 门下封驳闸(确定性入口质门,server-safe 纯函数,无 LLM)
 *
 * 设计依据:dev/notes/sansheng-design.md(5 大神一致=三省合并,唯门下独立否决以确定性闸存活)。
 * 门下守入口(执行前·合规安全轴),御史 gate.ts 守出口(执行后),二者对称双生。
 *
 * 铁律红线:
 *   1. 门下只行使二元封驳(pass/veto/reback)+ 理由,【禁返回 score、禁返回 draft】——它是一枚印,
 *      不是一支笔(那是丞相)、不是一杆秤(那是军机处)。type 层锁死,防它退化成"再打一次分/再拟一版"。
 *   2. 违祖训硬约束一律 veto,不可绕过(制衡的唯一不可替代内核)。
 *   3. 触真实产线资产/不可逆/高 blast-radius 必须有人工确认门签核,否则 veto 强制人工门(铁律1)。
 *   4. 确定性判定,不让 agent 判 agent(铁律6):祖训编译成硬约束、缺证机检,LLM 不参与放行。
 */

/** 门下封驳裁断:通过 / 否决 / 退回补证。 */
export type MenxiaVerdict = 'pass' | 'veto' | 'reback';

/** 门下唯一产出物:裁断 + 理由。结构上没有 score、没有 draft —— 一枚印,不是笔也不是秤。 */
export interface MenxiaRuling {
  verdict: MenxiaVerdict;
  reason: string;
}

export type BlastRadius = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

/** 门下闸的确定性输入(全部由上游机检/编译得到,不含主观打分)。 */
export interface MenxiaInput {
  /** 违祖训硬约束的条款(祖训编译后机检命中);非空=必 veto */
  ancestralViolations: string[];
  /** 触真实产线资产(PACK/报价/BOM/交期/付款/对外承诺/供应商锁定) */
  touchesProductionAsset: boolean;
  /** 不可逆动作 */
  irreversible: boolean;
  /** 爆炸半径等级(尚书省已在算此值) */
  blastRadius: BlastRadius;
  /** 人工确认门是否已签核 */
  humanSignoffPresent: boolean;
  /** 缺的关键证据项;非空且无上述高危=reback 退回补证 */
  criticalEvidenceGaps: string[];
}

const HIGH_RISK_RADIUS: ReadonlySet<BlastRadius> = new Set<BlastRadius>(['L3', 'L4']);

function isHighRisk(input: MenxiaInput): boolean {
  return input.touchesProductionAsset || input.irreversible || HIGH_RISK_RADIUS.has(input.blastRadius);
}

/**
 * 门下封驳闸:确定性入口质门。判定顺序(从最硬到最软):
 *   ① 违祖训 → veto(不可绕过)
 *   ② 高风险(产线/不可逆/L3-L4)且无人工签 → veto(强制走人工确认门)
 *   ③ 缺关键证据 → reback(退回补证)
 *   ④ 否则 → pass
 * 永远只返回 { verdict, reason };绝不返回 score / draft。
 */
export function menxiaGate(input: MenxiaInput): MenxiaRuling {
  if (input.ancestralViolations.length > 0) {
    return {
      verdict: 'veto',
      reason: `违祖训硬约束 [${input.ancestralViolations.join(' / ')}],门下封还,不可绕过`,
    };
  }
  if (isHighRisk(input) && !input.humanSignoffPresent) {
    const tags = [
      input.touchesProductionAsset ? '触真实产线资产' : '',
      input.irreversible ? '不可逆' : '',
      HIGH_RISK_RADIUS.has(input.blastRadius) ? `blast-radius=${input.blastRadius}` : '',
    ].filter(Boolean);
    return {
      verdict: 'veto',
      reason: `高风险 [${tags.join('+')}] 未过人工确认门,门下封还,必须经 L0-L4 人工签核(产线转 jiqun:8081)`,
    };
  }
  if (input.criticalEvidenceGaps.length > 0) {
    return {
      verdict: 'reback',
      reason: `缺关键证据 [${input.criticalEvidenceGaps.join(' / ')}],门下退回补证`,
    };
  }
  return { verdict: 'pass', reason: '无违祖训、无未签高风险、证据齐备,门下放行' };
}
