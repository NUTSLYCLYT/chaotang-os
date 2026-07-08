/**
 * 吏部 · 选才司 · 猎头人才画像匹配（2026-06-29）
 *
 * 主动猎才（不是被动等简历）：**锦衣卫搜人才 + 选才司评画像匹配**。
 * 合法 by design（镜像验客 prospect-qualify）：锦衣卫只从公开渠道搜+核实，**加好友/联系永远是人亲自做**；
 * 真搜索=外部副作用→锦衣卫蜂群(后端,铁律9)；前端只做"画像匹配评估"。纯函数。
 */

export interface TalentProfile {
  name: string;
  /** 候选人技能/背景关键词（锦衣卫从公开资料提取）。 */
  skills: string[];
  yearsExp: number | null;
  currentCompany?: string;
  /** 来源：锦衣卫公开搜 / 内推 / 上传。 */
  source: 'jinyiwei_search' | 'referral' | 'upload';
  /** 是否已有合法联系方式（无则需公开渠道/人亲自联系）。 */
  hasContact?: boolean;
}

export interface RoleRequirement {
  role: string;
  /** 硬性技能（缺即不匹配）。 */
  mustHave: string[];
  /** 加分技能。 */
  niceToHave: string[];
  minYears: number;
}

export type FitVerdict = 'strong_fit' | 'possible' | 'weak';

export const FIT_VERDICT_CN: Record<FitVerdict, string> = {
  strong_fit: '强匹配·优先接触',
  possible: '待定·可看',
  weak: '弱匹配·先放',
};

export interface TalentMatch {
  candidate: string;
  matchScore: number; // 0-100
  matched: string[];
  gaps: string[]; // 缺的硬性技能
  yearsOk: boolean;
  verdict: FitVerdict;
  compliance: string[]; // 合规旗(竞业/背调/联系合法)
  note: string;
}

import { skillsHave } from '@/core/courtos/primitives/skill-match';
function has(skills: string[], target: string): boolean {
  return skillsHave(skills, target);
}

/** 评一个候选人对岗位的画像匹配（纯函数）。硬性缺→拉低；合规旗显性。 */
export function matchTalent(profile: TalentProfile, req: RoleRequirement): TalentMatch {
  const matchedMust = req.mustHave.filter((m) => has(profile.skills, m));
  const gaps = req.mustHave.filter((m) => !has(profile.skills, m));
  const matchedNice = req.niceToHave.filter((n) => has(profile.skills, n));
  const yearsOk = profile.yearsExp != null && profile.yearsExp >= req.minYears;

  // 评分：硬性命中率 70% + 加分 20% + 年限 10%
  const mustScore = req.mustHave.length ? matchedMust.length / req.mustHave.length : 1;
  const niceScore = req.niceToHave.length ? matchedNice.length / req.niceToHave.length : 0;
  const matchScore = Math.round((mustScore * 0.7 + niceScore * 0.2 + (yearsOk ? 0.1 : 0)) * 100);

  const verdict: FitVerdict = gaps.length === 0 && yearsOk && matchScore >= 70 ? 'strong_fit' : gaps.length <= 1 && matchScore >= 45 ? 'possible' : 'weak';

  const compliance: string[] = [];
  if (!profile.hasContact) compliance.push('暂无合法联系方式：经公开商务渠道/内推接触，不抓取隐私');
  if (profile.currentCompany) compliance.push(`在职于${profile.currentCompany}：接触前查竞业限制，避法律风险`);
  compliance.push('背景调查在 offer 前由人工核实，本评估仅画像匹配');

  const note =
    `${FIT_VERDICT_CN[verdict]}（匹配 ${matchScore}）` +
    (gaps.length ? ` · 缺硬性:${gaps.join('/')}` : ' · 硬性全中') +
    (yearsOk ? '' : ` · 年限不足(需${req.minYears}年)`);

  return { candidate: profile.name, matchScore, matched: matchedMust.concat(matchedNice), gaps, yearsOk, verdict, compliance, note };
}

/** 批量猎才：一批锦衣卫搜来的候选人 → 排序匹配。 */
export function rankTalent(profiles: TalentProfile[], req: RoleRequirement): TalentMatch[] {
  return profiles.map((p) => matchTalent(p, req)).sort((a, b) => b.matchScore - a.matchScore);
}
