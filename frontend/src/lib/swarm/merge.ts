/**
 * merge —— 丞相的【确定性合并节点】（大神会审 6/6 共识的"只做一件事"）。
 *
 * "Build the merge, not the orchestra."（Karpathy）。把 N 个部门的 AgentResult collapse 成
 * 一个老板能拍板的判断——纯确定性、零新 LLM、继承 number-verifier 纪律：
 *   · 无矛盾 → 直接合并（根本不需要 LLM）。
 *   · 两个【都接地】的部门硬冲突 → 不自动裁决，BOTH 摊开、标红、伏候圣裁（Bezos：冲突显式呈现给老板）。
 *   · 终判由部门原话拼成，不引入任何新数字 → 接地 by construction（绝不"戴皇冠的 2.58"）。
 *   · 不让 agent 裁决 agent：胜出靠确定性竞争场（接地 > 置信），不靠 LLM 当法官（Minsky/Ng）。
 */

import type { AgentResult } from './dept-agent';
import { verifyNumbers } from './number-verifier';
import { swarmToCn as cn } from './dept-identity'; // 部门命名 SSOT(铁律2)

export interface DeptContribution {
  dept: string;
  name: string;
  answer: string;
  confidence: number;
  grounded: boolean;
  groundingRate: number;
  conflicts: string;
}

export interface MergeConflict {
  depts: string[]; // 冲突的部门（中文名）；applyPriors 后历史偏好方排首位（默认高亮）
  detail: string; // 谁声明会被谁推翻
  prior?: { lead: string | null; leadCount: number; total: number }; // 老板历史偏好(只读建议)
}

export interface EdgePrior {
  tally: Record<string, number>; // 部门中文名 → 老板历史选它的次数
  total: number;
}

export interface MergeVerdict {
  verdict: string; // 老板可拍板的合并判断（或伏候圣裁的并陈）
  escalateToBoss: boolean; // 有"都接地却互相冲突"→ 不自动裁决，升级老板
  grounded: boolean; // 终判每个数字都能 grep 回某部门 grounded evidence（by construction 应为 true）
  leadDept: string | null; // 无冲突时的主答部门
  contributors: DeptContribution[];
  conflicts: MergeConflict[]; // 摊开的硬冲突（未被裁决）
}

function toContribution(dept: string, r: AgentResult): DeptContribution {
  return {
    dept,
    name: cn(dept),
    answer: String(r.answer ?? ''),
    confidence: typeof r.confidence === 'number' ? r.confidence : 0,
    grounded: !!r.grounded,
    groundingRate: r.grounding?.rate ?? 0,
    conflicts: String(r.conflicts ?? '无'),
  };
}

/** 竞争场排序：接地优先，其次置信，其次接地率。确定性，无 LLM 裁判。 */
function rank(a: DeptContribution, b: DeptContribution): number {
  if (a.grounded !== b.grounded) return a.grounded ? -1 : 1;
  if (a.confidence !== b.confidence) return b.confidence - a.confidence;
  return b.groundingRate - a.groundingRate;
}

/**
 * 检测硬冲突：两个【都接地】的部门，其一在 conflicts 里点名了另一个在场部门 → 硬冲突。
 * 用的是已有的 conflicts 字段（stigmergy 信号），纯确定性，不调 LLM 判断语义矛盾。
 */
function detectConflicts(contribs: DeptContribution[]): MergeConflict[] {
  const grounded = contribs.filter((c) => c.grounded);
  const out: MergeConflict[] = [];
  const seen = new Set<string>();
  for (const a of grounded) {
    for (const b of grounded) {
      if (a.dept === b.dept) continue;
      // a 的冲突声明里点到了 b（中文名）
      if (a.conflicts && a.conflicts !== '无' && a.conflicts.includes(b.name)) {
        const key = [a.dept, b.dept].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ depts: [a.name, b.name], detail: `${a.name}声明：${a.conflicts}` });
      }
    }
  }
  return out;
}

/**
 * mergeDecisions —— 把各部门结论合并成一个老板判断。
 * @param results [{ dept, result }] 各部门单 agent 的产出
 */
export function mergeDecisions(results: Array<{ dept: string; result: AgentResult }>): MergeVerdict {
  const contributors = results.map((x) => toContribution(x.dept, x.result));
  const conflicts = detectConflicts(contributors);
  const escalateToBoss = conflicts.length > 0;

  let verdict: string;
  let leadDept: string | null = null;

  if (escalateToBoss) {
    // 不裁决：把冲突双方原话并陈，伏候圣裁
    const lines = contributors
      .filter((c) => c.grounded)
      .map((c) => `· 【${c.name}】${c.answer}`)
      .join('\n');
    const conflictLines = conflicts.map((c) => `⚠️ ${c.depts.join(' ↔ ')}：${c.detail}`).join('\n');
    verdict = `⚠️ 跨部门硬冲突，伏候圣裁（各部门均已接地，臣不敢代陛下裁夺）：\n${lines}\n\n${conflictLines}`;
  } else {
    const sorted = [...contributors].sort(rank);
    const lead = sorted[0];
    leadDept = lead?.dept ?? null;
    const others = sorted.slice(1).filter((c) => c.answer);
    const supporting = others.length
      ? '\n\n各部门均无硬冲突，附议：\n' + others.map((c) => `· 【${c.name}】${c.answer}`).join('\n')
      : '';
    verdict = lead ? `【主判·${lead.name}】${lead.answer}${supporting}` : '（无可用部门结论）';
  }

  // 接地纪律（继承 number-verifier）：终判每个数字必须能 grep 回某 grounded 部门的输出。
  // 终判由 grounded 部门的 answer + conflicts 逐字拼成、不引入新数字 → 这两样即合法 context；
  // 若仍有数字 grep 不到，说明 merge 引入了新数（不该发生）→ 降级，绝不"戴皇冠的 2.58"。
  const groundedContext = contributors
    .filter((c) => c.grounded)
    .flatMap((c) => [c.answer, c.conflicts])
    .join('\n');
  const g = verifyNumbers(verdict, groundedContext);
  const grounded = g.ungrounded.length === 0;

  return { verdict, escalateToBoss, grounded, leadDept, contributors, conflicts };
}

/**
 * applyPriors —— 把老板历史偏好(boss_preferences)叠加到已 merge 的结果上,闭合 Bezos 飞轮:
 *   · 改变硬冲突的呈现顺序(历史最常被准的部门排首位 = 默认高亮);
 *   · 在 verdict 文本尾部附"此争陛下历史 N/M 次准〔X〕(仅供参考,仍候圣裁)"。
 * 这是飞轮"复利"那一环:学到的偏好可证明地改变下一次输出。**但绝不自动裁决** ——
 * 只改"呈现顺序/高亮/提示",不改 escalateToBoss(硬冲突仍升级老板)。纯函数,无 IO,可单测。
 */
export function applyPriors(
  merge: MergeVerdict,
  priorsByEdge: Record<string, EdgePrior>,
): MergeVerdict {
  if (!merge.escalateToBoss || merge.conflicts.length === 0) return merge;
  const conflicts = merge.conflicts.map((c) => {
    const edge = [...c.depts].sort().join('|');
    const p = priorsByEdge[edge];
    if (!p || p.total === 0) return c;
    let lead: string | null = null;
    let leadCount = 0;
    for (const [dept, n] of Object.entries(p.tally)) {
      if (n > leadCount) {
        lead = dept;
        leadCount = n;
      }
    }
    const depts = lead ? [lead, ...c.depts.filter((d) => d !== lead)] : c.depts;
    return { ...c, depts, prior: { lead, leadCount, total: p.total } };
  });
  const priorLines = conflicts
    .filter((c) => c.prior?.lead)
    .map(
      (c) =>
        `📜 此争陛下历史 ${c.prior!.leadCount}/${c.prior!.total} 次准〔${c.prior!.lead}〕（仅供参考，仍候圣裁）`,
    );
  const verdict = priorLines.length > 0 ? `${merge.verdict}\n\n${priorLines.join('\n')}` : merge.verdict;
  return { ...merge, verdict, conflicts };
}
