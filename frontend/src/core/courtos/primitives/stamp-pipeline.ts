/**
 * 决策原语 · 盖章流水线（2026-06-29）
 *
 * 通用原语(部门无关)：多方各盖一个章(pass/caution/block)，确定性合并(worst-wins)，不群聊。
 * Karpathy：多方协作沟通 O(N) 非 O(N²)。任何跨方/跨部门决策都 import 这个，不各写一套(铁律2)。
 */

export type Dept = 'libu' | 'jinyiwei' | 'hubu' | 'xingbu' | 'bingbu' | 'gongbu' | 'qintian' | 'prime';

export const DEPT_CN: Record<Dept, string> = {
  libu: '吏部',
  jinyiwei: '锦衣卫',
  hubu: '户部',
  xingbu: '刑部',
  bingbu: '兵部',
  gongbu: '工部',
  qintian: '钦天监',
  prime: '丞相',
};

export type StampVerdict = 'pass' | 'caution' | 'block';

export interface Stamp {
  dept: Dept;
  role: string;
  verdict: StampVerdict;
  finding: string;
}

export type OverallVerdict = 'approved' | 'conditional' | 'blocked';

export interface StampReview {
  decision: string;
  stamps: Stamp[];
  overall: OverallVerdict;
  blockers: string[];
  cautions: string[];
  note: string;
}

const RANK: Record<StampVerdict, number> = { pass: 0, caution: 1, block: 2 };

/** 合并盖章：worst-wins。block→blocked；caution→conditional；全 pass→approved。 */
export function mergeStamps(decision: string, stamps: Stamp[]): StampReview {
  const worst = stamps.reduce<StampVerdict>((w, s) => (RANK[s.verdict] > RANK[w] ? s.verdict : w), 'pass');
  const overall: OverallVerdict = worst === 'block' ? 'blocked' : worst === 'caution' ? 'conditional' : 'approved';
  const blockers = stamps.filter((s) => s.verdict === 'block').map((s) => `${DEPT_CN[s.dept]}：${s.finding}`);
  const cautions = stamps.filter((s) => s.verdict === 'caution').map((s) => `${DEPT_CN[s.dept]}：${s.finding}`);
  const note =
    overall === 'blocked'
      ? `🔴 驳回 — ${blockers.join('；')}（须先解决再议）`
      : overall === 'conditional'
        ? `🟡 有条件通过 — 注意：${cautions.join('；')}`
        : `🟢 ${stamps.length}方全通过`;
  return { decision, stamps, overall, blockers, cautions, note };
}
