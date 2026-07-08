/**
 * lifu-stakeholder-priority —— 礼部关系台账司·干系人优先级(吸收业界标准,纯查表/算术)。
 *
 * 吸收(开源研究 Top1,捞原则非整搬):
 *  · RFM 五分位(Chen/Sain/Guo 2012;Putler/Braze 11 段)——R=距上次接触天数(反向)/F=接触次数/M=合作价值。
 *  · Salience 模型(Mitchell/Agle/Wood 1997)——Power×Legitimacy×Urgency → 7 类,Definitive 最高。
 *  · Mendelow 权力-利益网格(1981)——Power×Interest → 4 象限。
 * 纯函数·零依赖。诚实(铁律3/4):P/L/U/Power/Interest 是【人工裁量输入】,本引擎只做确定性分级,
 * 不把"主观判断"伪装成客观真相——输出带 `humanJudged` 标记提示哪些靠人估。
 */

export interface StakeholderRecord {
  id: string;
  name: string;
  /** 距上次接触天数(越小越好;RFM 的 R)。 */
  recencyDays: number;
  /** 接触/互动次数(F)。 */
  frequency: number;
  /** 合作金额/价值(M)。 */
  monetary: number;
  /** 以下为人工裁量输入(Salience/Mendelow)。 */
  power: boolean;
  legitimacy: boolean;
  urgency: boolean;
  /** 对你的事关注度高(Mendelow 的 Interest)。 */
  interest: boolean;
}

export type SalienceClass =
  | 'definitive' | 'dominant' | 'dangerous' | 'dependent'
  | 'dormant' | 'discretionary' | 'demanding' | 'non';
export type MendelowQuadrant = 'manage_closely' | 'keep_satisfied' | 'keep_informed' | 'monitor';

export interface StakeholderPriority {
  id: string;
  name: string;
  rfm: { r: number; f: number; m: number; code: string; segment: string };
  salience: { class: SalienceClass; priority: number };
  mendelow: MendelowQuadrant;
  /** 综合优先序(越大越该优先碰)。 */
  rank: number;
  /** 哪些结论依赖人工裁量输入(防伪客观)。 */
  humanJudged: string[];
}

/** 在队列内按五分位给分(1-5);reverse=越小越高分(用于 recency)。 */
function quintile(values: number[], v: number, reverse = false): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = sorted.filter((x) => x <= v).length; // 1..n
  const q = Math.ceil((idx / sorted.length) * 5) || 1;
  return reverse ? 6 - q : q;
}

function rfmSegment(r: number, f: number, m: number): string {
  const fm = (f + m) / 2;
  if (r >= 4 && fm >= 4) return 'Champions 核心';
  if (r >= 4 && fm < 3) return 'New 新晋';
  if (r <= 2 && fm >= 4) return 'At Risk 流失风险';
  if (r <= 2 && fm <= 2) return 'Lost 已凉';
  if (r >= 3 && fm >= 3) return 'Loyal 稳定';
  return 'Needs Attention 待经营';
}

function salienceClass(p: boolean, l: boolean, u: boolean): { class: SalienceClass; priority: number } {
  if (p && l && u) return { class: 'definitive', priority: 7 };
  if (p && l) return { class: 'dominant', priority: 6 };
  if (p && u) return { class: 'dangerous', priority: 5 };
  if (l && u) return { class: 'dependent', priority: 4 };
  if (p) return { class: 'dormant', priority: 3 };
  if (l) return { class: 'discretionary', priority: 2 };
  if (u) return { class: 'demanding', priority: 1 };
  return { class: 'non', priority: 0 };
}

function mendelow(power: boolean, interest: boolean): MendelowQuadrant {
  if (power && interest) return 'manage_closely';
  if (power && !interest) return 'keep_satisfied';
  if (!power && interest) return 'keep_informed';
  return 'monitor';
}

export function prioritizeStakeholders(records: StakeholderRecord[]): StakeholderPriority[] {
  if (records.length === 0) return [];
  const recencies = records.map((s) => s.recencyDays);
  const freqs = records.map((s) => s.frequency);
  const monies = records.map((s) => s.monetary);

  return records
    .map((s) => {
      const r = quintile(recencies, s.recencyDays, true); // recency 反向
      const f = quintile(freqs, s.frequency);
      const m = quintile(monies, s.monetary);
      const sal = salienceClass(s.power, s.legitimacy, s.urgency);
      const humanJudged: string[] = [];
      if (s.power || s.legitimacy || s.urgency) humanJudged.push('Salience(权力/正当/紧迫)为人工判断');
      if (s.power || s.interest) humanJudged.push('Mendelow(权力/利益)为人工判断');
      // 综合:Salience 主序(×10)+ RFM 次序
      const rank = sal.priority * 10 + r + f + m;
      return {
        id: s.id,
        name: s.name,
        rfm: { r, f, m, code: `${r}${f}${m}`, segment: rfmSegment(r, f, m) },
        salience: sal,
        mendelow: mendelow(s.power, s.interest),
        rank,
        humanJudged,
      };
    })
    .sort((a, b) => b.rank - a.rank);
}
