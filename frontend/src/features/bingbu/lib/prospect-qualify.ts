/**
 * 客户验证引擎 · 锦衣卫验客 → 兵部备战的大脑（2026-06-28）
 *
 * 合法 by design（不是靠自觉，靠类型 + 结构）：
 *   ① 只判断，不抓取、不外联——纯函数，零副作用。
 *   ② 数据来源没有 'scraped' 选项——结构上拒绝抓取来的个人数据（PIPL/GDPR 红线）。
 *   ③ 输出只有 humanActions（人该做的合法动作），没有任何 auto-execute 字段——
 *      结构上不可能自动加好友/群发。真外联是人扳机（铁律9 + 13.2 人工门）。
 *   ④ 负向验证：会说"为什么不是你的客户"，省下碰错人的时间（比正向更值钱）。
 *
 * 镜像 hubu-engines 的纯函数风格；不写库、不调外部。
 */

/** 目标客户画像（ICP）——你定义"谁是你的客户"。 */
export interface IcpProfile {
  /** 目标行业（命中其一即行业匹配）。 */
  industries: string[];
  /** 规模区间（人数或营收档，可选）。 */
  sizeMin?: number;
  sizeMax?: number;
  /** 采购信号关键词（招聘/扩张/融资/换供应商/新工厂…命中越多越热）。 */
  signals: string[];
  /** 排除项（已是客户/竞品/黑名单/不合规行业）——命中即直接 not_target。 */
  disqualifiers?: string[];
}

/**
 * 数据来源——合法性审计的核心。
 * 注意：**没有 'scraped'**。抓取来的陌生人个人数据不被本引擎接受（违 PIPL/GDPR）。
 */
export type ProspectSource = 'public_business' | 'user_provided' | 'inbound' | 'referral';

export type ContactChannel = 'email' | 'wechat' | 'telegram' | 'phone';

export interface Contact {
  channel: ContactChannel;
  value: string;
  /** 是否已获对方同意联系（合规关键）。未知/未获同意 → 合规旗。 */
  consent?: boolean;
}

export interface Prospect {
  id: string;
  /** 公司或人名。 */
  name: string;
  industry?: string;
  /** 规模（人数或营收档）。 */
  size?: number;
  /** 锦衣卫/你观察到的信号（用于和 ICP signals 匹配）。 */
  observedSignals?: string[];
  /** 数据来源（合法性审计；无 'scraped'）。 */
  source: ProspectSource;
  /** 你"已合法获得"的联系方式（公开商务/对方留资/转介）。 */
  contacts?: Contact[];
  notes?: string;
}

export type QualifyVerdict = 'target' | 'maybe' | 'not_target';

export interface QualifyResult {
  verdict: QualifyVerdict;
  /** 0-100 综合匹配分。 */
  matchScore: number;
  industryMatch: boolean;
  matchedSignals: string[];
  /** 为什么是/不是（负向也给）。 */
  reasons: string[];
  priority: 'P0' | 'P1' | 'P2';
  /** AI 建议的开场角度（不是完整话术，是切入点——人再个性化）。 */
  outreachAngle: string;
  /** 人扳机：必须由人完成的合法动作。引擎只输出清单，绝不代执行。 */
  humanActions: string[];
  /** 合规提示（缺联系方式/来源存疑/未获同意）。 */
  complianceFlags: string[];
}

const SIZE_OK_WEIGHT = 20;
const INDUSTRY_WEIGHT = 35;
const SIGNAL_WEIGHT = 15; // 每个命中信号

function inSizeRange(size: number | undefined, icp: IcpProfile): boolean | null {
  if (size == null) return null; // 未知
  if (icp.sizeMin != null && size < icp.sizeMin) return false;
  if (icp.sizeMax != null && size > icp.sizeMax) return false;
  return true;
}

/** 排除项命中（行业/名称/信号里出现任一 disqualifier 关键词）。 */
function hitDisqualifier(p: Prospect, icp: IcpProfile): string | null {
  const hay = [p.industry ?? '', p.name, ...(p.observedSignals ?? []), p.notes ?? ''].join(' ').toLowerCase();
  for (const d of icp.disqualifiers ?? []) {
    if (d && hay.includes(d.toLowerCase())) return d;
  }
  return null;
}

/**
 * 验证一个潜在客户是不是你的目标客户。纯函数：同输入恒同输出，零副作用。
 */
export function qualifyProspect(p: Prospect, icp: IcpProfile): QualifyResult {
  const reasons: string[] = [];
  const complianceFlags: string[] = [];

  // —— 合规先行（来源 + 联系方式同意）——
  const consentedContacts = (p.contacts ?? []).filter((c) => c.consent === true);
  if (!p.contacts || p.contacts.length === 0) {
    complianceFlags.push('暂无联系方式：需通过公开商务渠道/对方留资合法获取，禁抓取');
  } else if (consentedContacts.length === 0) {
    complianceFlags.push('联系方式未标记"已获同意"：首次触达需合规（公开商务联系/已留资），勿群发');
  }

  // —— 排除项：命中即直接出局 ——
  const dq = hitDisqualifier(p, icp);
  if (dq) {
    return {
      verdict: 'not_target',
      matchScore: 0,
      industryMatch: false,
      matchedSignals: [],
      reasons: [`命中排除项「${dq}」→ 不是目标客户，别花时间`],
      priority: 'P2',
      outreachAngle: '—',
      humanActions: ['跳过：已排除'],
      complianceFlags,
    };
  }

  // —— 行业匹配 ——
  const industryMatch = !!p.industry && icp.industries.some((i) => p.industry!.includes(i) || i.includes(p.industry!));
  if (industryMatch) reasons.push(`行业匹配（${p.industry}）`);
  else if (p.industry) reasons.push(`行业不匹配（${p.industry} 不在目标行业）`);
  else complianceFlags.push('行业未知：建议先补行业再判断');

  // —— 信号匹配 ——
  const matchedSignals = (p.observedSignals ?? []).filter((s) =>
    icp.signals.some((k) => s.includes(k) || k.includes(s)),
  );
  if (matchedSignals.length) reasons.push(`采购信号 ×${matchedSignals.length}：${matchedSignals.join('、')}`);
  else reasons.push('无明确采购信号（可能还不到买的时候）');

  // —— 规模 ——
  const sizeOk = inSizeRange(p.size, icp);
  if (sizeOk === false) reasons.push('规模不在目标区间');
  else if (sizeOk === true) reasons.push('规模匹配');

  // —— 综合分 ——
  let score = 0;
  if (industryMatch) score += INDUSTRY_WEIGHT;
  score += Math.min(matchedSignals.length * SIGNAL_WEIGHT, 45);
  if (sizeOk === true) score += SIZE_OK_WEIGHT;
  score = Math.max(0, Math.min(100, score));

  // —— 裁决 ——
  let verdict: QualifyVerdict;
  if (industryMatch && matchedSignals.length >= 1 && score >= 55) verdict = 'target';
  else if (industryMatch || matchedSignals.length >= 1) verdict = 'maybe';
  else verdict = 'not_target';

  const priority: QualifyResult['priority'] =
    verdict === 'target' && matchedSignals.length >= 2 ? 'P0' : verdict === 'target' ? 'P1' : 'P2';

  // —— 开场角度（拿最强信号做切入，不是完整话术）——
  const outreachAngle =
    verdict === 'not_target'
      ? '—（非目标，不建议外联）'
      : matchedSignals.length
        ? `切入点：对方「${matchedSignals[0]}」→ 你能帮上的那块；人再个性化成一句话开场`
        : '切入点：先确认需求时机，别硬推；以行业洞察破冰';

  // —— 人扳机：永远是人做（引擎不代执行）——
  const humanActions =
    verdict === 'not_target'
      ? ['跳过：非目标客户']
      : [
          '由你/销售本人通过对方公开商务渠道发起（勿用自动加好友/群发工具）',
          'AI 草稿仅作底稿，发送前人工个性化 + 人工点发送',
          consentedContacts.length === 0 ? '首次触达务必合规：公开联系方式/对方已留资，记录同意来源' : '已获同意，可按约定渠道触达',
        ];

  return { verdict, matchScore: score, industryMatch, matchedSignals, reasons, priority, outreachAngle, humanActions, complianceFlags };
}

export const QUALIFY_VERDICT_CN: Record<QualifyVerdict, string> = {
  target: '目标客户',
  maybe: '待定',
  not_target: '非目标',
};
