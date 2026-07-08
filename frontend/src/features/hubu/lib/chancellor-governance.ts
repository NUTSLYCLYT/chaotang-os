/**
 * 丞相治理 · 护栏通电(接点③ · 2026-07-01)
 *
 * 给两个"造好没用"的空挂原语通电,把丞相产出从"好看的话"变成"可签字、有边界"的裁断:
 *   1. ZChancellorDecision —— 把判词校验成可签裁断:必须裁掉≥1冲突(裁断非汇总)+ superRefine 反"正确的废话"。
 *   2. classifyChancellorAction —— 把铁律9 边界从注释变运行时:采纳若碰真产线 → 要旨+人工门,fail-safe 未知归 execute。
 *
 * 纯函数,确定性,可单测(铁律4)。不执行、不写库、不调模型——只判"这份裁断合不合法、采纳算不算越界"。
 */

import type { HubuEvaluation } from '@/features/hubu/lib/hubu-engines';
import type { UnifiedConflict, UnifiedDepartmentId } from '@/core/courtos/unified/unified-types';
import {
  classifyChancellorAction,
  type ActionClassification,
} from '@/core/courtos/chancellor/mandate';
import { ZChancellorDecision, type TChancellorDecision } from '@/lib/contracts/chancellor-decision';

/** 部门中文名 SSOT(会审 LOW-1:原在组件里重复,收口到此处一处)。 */
export const DEPT_CN: Record<UnifiedDepartmentId, string> = {
  jinyiwei: '锦衣卫', finance: '户部', war: '兵部', personnel: '吏部', justice: '刑部', ritual: '礼部', works: '工部',
};

export interface ChancellorGovernance {
  /** 校验通过的裁断(null=校验未过,见 issues)。 */
  decision: TChancellorDecision | null;
  decisionValid: boolean;
  decisionIssues: string[];
  /** 采纳这条意味着什么(consult 自治 / execute 要旨+人工门)。 */
  acceptAction: ActionClassification;
}

function chancellorRuling(c: UnifiedConflict, ev: HubuEvaluation): string {
  if (ev.cashStress) return '现金优先,回报让位——先压最坏现金曲线再议推进';
  if (ev.missing.length > 0) return `缺证未补不放行:先补「${ev.missing[0]}」,补齐再裁`;
  if (ev.oneWayDoor.oneWay) return '不可逆部分拆出单独亲裁,可逆部分先小试';
  return `${DEPT_CN[c.between[1]] ?? c.between[1]}的顾虑先解,再准${DEPT_CN[c.between[0]] ?? c.between[0]}推进`;
}

/** 由真户部裁决 + 跨部冲突,构建并校验丞相裁断 + 采纳动作边界。 */
export function governChancellor(
  ev: HubuEvaluation,
  conflicts: UnifiedConflict[],
): ChancellorGovernance {
  const conflictsResolved =
    conflicts.length > 0
      ? conflicts.map((c) => ({
          between: [DEPT_CN[c.between[0]] ?? c.between[0], DEPT_CN[c.between[1]] ?? c.between[1]],
          ruling: chancellorRuling(c, ev),
        }))
      : [
          {
            between: ['推进', '谨慎'],
            ruling: ev.missing.length
              ? `缺证未补,先压不放:补「${ev.missing[0]}」`
              : ev.cashStress
                ? '现金优先,回报让位'
                : '证据齐可推进,须带证据链归档',
          },
        ];

  const theOneThing = ev.missing[0]
    ? `补齐「${ev.missing[0]}」`
    : ev.cashStress
      ? '先压最坏现金曲线'
      : '带证据链归档后推进';

  const theThingToNotDo = {
    action: ev.oneWayDoor.oneWay
      ? `绝不一键静默准奏(${ev.oneWayDoor.reasons.join('、')})`
      : ev.missing.length > 0
        ? '绝不在缺证下把判词当定论批'
        : '绝不为赶进度跳过现金核',
    reason: ev.oneWayDoor.oneWay
      ? '单向门错了难撤,必须陛下亲裁'
      : ev.missing.length > 0
        ? '缺证下批 = 拿信任赌运气'
        : '现金断流是小老板头号死法',
  };

  const reversibility: TChancellorDecision['reversibility'] = ev.oneWayDoor.oneWay
    ? 'one_way_door'
    : 'two_way_door';

  const signoffRequired = ev.oneWayDoor.oneWay || ev.cashStress;

  const candidate = {
    verdict: ev.verdictCn,
    theOneThing,
    theThingToNotDo,
    conflictsResolved,
    reversibility,
    signoff: {
      required: signoffRequired,
      basis: signoffRequired
        ? ev.oneWayDoor.oneWay
          ? '不可逆 × 对外承诺/重大付款'
          : '现金流压力下需老板亲签'
        : '可逆且现金安全,无需额外签',
    },
  };

  const parsed = ZChancellorDecision.safeParse(candidate);

  // 采纳=立项,碰真产线资产(预算/对外承诺)→ 铁律9:要旨 + 人工门。fail-safe 由原语保证。
  const acceptAction = classifyChancellorAction(
    signoffRequired ? 'submit_production_asset' : 'compose_memorial',
  );

  return {
    decision: parsed.success ? parsed.data : null,
    decisionValid: parsed.success,
    decisionIssues: parsed.success ? [] : parsed.error.issues.map((i) => i.message),
    acceptAction,
  };
}
