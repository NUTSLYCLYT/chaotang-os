/**
 * 吏部杀手会审 → 军机处 session（2026-06-29）
 *
 * 天才设计落地(选3)：吏部辞退/招人决策接进军机处会审流，复用已有军机处UI(不新建吏部舱)。
 * "立项的家在军机处"——老板下人事旨 → 吏部杀手引擎跨部门会审 → 军机处会审流显挡雷方案。
 * 把吏部引擎输出转成 CouncilLiveSessionInput(军机处既有 session 格式)，纯函数。
 */
import type { CouncilLiveSessionInput } from '@/features/imperial/grand-council/lib/council-source';
import { reviewTermination, TERMINATION_VERDICT_CN, type TerminationInput } from './termination-review';
import { reviewHiringCrossDept, type HiringCrossInput } from './cross-dept-review';

/** 辞退会审 → 军机处 session（吏部劳关+刑部劳动法+户部成本 各发言）。 */
export function terminationCouncilSession(input: TerminationInput, at: string): CouncilLiveSessionInput {
  const r = reviewTermination(input);
  return {
    taskId: `libu-termination-${input.employeeName}`,
    command: `辞退${input.employeeName}`,
    at,
    verdict: `${TERMINATION_VERDICT_CN[r.verdict]} — ${r.legalPath}`,
    escalateToBoss: r.verdict === 'illegal_risk', // 违法解除高风险 → 伏候圣裁
    grounded: r.missing.length === 0,
    leadDept: '吏部',
    contributors: [
      { dept: '吏部', name: '吏部·劳关司', answer: r.laborOpinion, confidence: 0.8, grounded: r.missing.length === 0 },
      { dept: '刑部', name: '刑部·劳动法', answer: r.legalRisk, confidence: 0.9, grounded: true },
      { dept: '户部', name: '户部·成本', answer: r.costOpinion, confidence: 0.85, grounded: r.severanceN != null },
    ],
    conflicts: r.verdict === 'illegal_risk' ? [{ depts: ['吏部', '刑部'], detail: r.blockers.join('；') }] : [],
  };
}

/** 招人会审 → 军机处 session（选才+锦衣卫+户部+刑部 盖章发言）。 */
export function hiringCouncilSession(input: HiringCrossInput, at: string): CouncilLiveSessionInput {
  const r = reviewHiringCrossDept(input);
  const deptName: Record<string, string> = { libu: '吏部·选才司', jinyiwei: '锦衣卫·背调', hubu: '户部·预算', xingbu: '刑部·竞业' };
  return {
    taskId: `libu-hiring-${input.role}`,
    command: `招聘${input.role}`,
    at,
    verdict: r.note,
    escalateToBoss: r.overall === 'blocked',
    grounded: true,
    leadDept: '吏部',
    contributors: r.stamps.map((s) => ({
      dept: deptName[s.dept]?.split('·')[0] ?? s.dept,
      name: s.role,
      answer: `${s.verdict === 'pass' ? '✓' : s.verdict === 'block' ? '🔴' : '🟡'} ${s.finding}`,
      confidence: 0.85,
      grounded: true,
    })),
    conflicts: r.blockers.length ? [{ depts: ['户部'], detail: r.blockers.join('；') }] : [],
  };
}
