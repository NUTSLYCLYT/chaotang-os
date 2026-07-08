/**
 * lifu-negotiation —— 礼部·对外承诺/谈判(吸收 Harvard PON + Faratin,纯算术)。
 *
 * 吸收(开源研究块5,捞公式非整搬):
 *  · BATNA/保留价/ZOPA(Fisher&Ury):dealPossible = sellerRes ≤ buyerRes;surplus=buyerRes−sellerRes。
 *  · 决策规则:offer 达到己方保留价则接受,否则还价/走。
 *  · 加权效用(PON Scoring a Deal):U=Σ wᵢ·uᵢ。
 *  · 时间依赖让步(Faratin/Sierra/Jennings 1998):offer(t)=floor+(1−α)·(start−floor),α=(t/deadline)^(1/β)。
 *    β<1 Boulware(晚让)/β>1 Conceder(早让)。
 * 纯算术·零依赖。诚实:BATNA/权重/保留价是【人工裁量】(humanJudged)。
 * 接朝堂高风险门:任何对外承诺(报价/让步/独家/违约金)→ needsSignoff,禁一键静默(铁律13.2.5)。
 */

export interface OfferEval {
  /** 己方保留价(BATNA 推导,人工输入)。 */
  ownReservation: number;
  /** 对方保留价(估计,可缺)。 */
  counterpartReservation?: number;
  offer: number;
  /** 卖方=报价越高越好(默认);买方=越低越好。 */
  betterWhenHigher?: boolean;
}

export interface OfferDecision {
  meetsReservation: boolean;
  zopaExists: boolean | null;
  surplus: number | null;
  decision: 'accept' | 'counter' | 'walk';
  reason: string;
  /** 对外承诺一律过人工门。 */
  needsSignoff: boolean;
  humanJudged: string[];
}

export function evaluateOffer(i: OfferEval): OfferDecision {
  const higher = i.betterWhenHigher ?? true;
  const meets = higher ? i.offer >= i.ownReservation : i.offer <= i.ownReservation;

  let zopaExists: boolean | null = null;
  let surplus: number | null = null;
  if (i.counterpartReservation != null) {
    // 卖方:buyerRes(对方愿付上限) ≥ sellerRes(己方底价) 才有 ZOPA
    const [low, high] = higher ? [i.ownReservation, i.counterpartReservation] : [i.counterpartReservation, i.ownReservation];
    zopaExists = low <= high;
    surplus = Math.round((high - low) * 100) / 100;
  }

  let decision: OfferDecision['decision'];
  let reason: string;
  if (meets) {
    decision = 'accept';
    reason = '报价达到/优于己方保留价,可接受(仍须人工确认)';
  } else if (zopaExists === false) {
    decision = 'walk';
    reason = '无 ZOPA(双方底价不重叠),走人,靠 BATNA';
  } else {
    decision = 'counter';
    reason = '未达己方保留价但可能有空间,还价';
  }

  return {
    meetsReservation: meets,
    zopaExists,
    surplus,
    decision,
    reason,
    needsSignoff: true,
    humanJudged: ['BATNA/保留价为人工裁量', i.counterpartReservation != null ? '对方保留价为估计' : '未估对方保留价,ZOPA 未知'],
  };
}

/** 加权效用 U=Σ wᵢ·uᵢ(议题 weight 和不必为1,内部归一)。 */
export function dealUtility(issues: Array<{ weight: number; score: number }>): number {
  const wsum = issues.reduce((a, b) => a + b.weight, 0);
  if (wsum <= 0) return 0;
  const u = issues.reduce((a, b) => a + b.weight * b.score, 0) / wsum;
  return Math.round(u * 1000) / 1000;
}

/**
 * 时间依赖让步报价。t/deadline∈[0,1];beta<1 晚让(强硬)/beta>1 早让(软)。
 * start=初始报价,floor=底线(保留价)。
 */
export function concessionOffer(t: number, deadline: number, start: number, floor: number, beta: number): number {
  const ratio = deadline > 0 ? Math.min(1, Math.max(0, t / deadline)) : 1;
  const alpha = Math.pow(ratio, 1 / beta);
  return Math.round((floor + (1 - alpha) * (start - floor)) * 100) / 100;
}
