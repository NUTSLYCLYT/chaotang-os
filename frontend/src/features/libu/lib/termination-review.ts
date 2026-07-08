/**
 * 吏部 · 劳关司 · 辞退跨部门会审（2026-06-28）
 *
 * 朝堂护城河样板：一道"辞退X"的旨 → **吏部劳关 + 刑部劳动风险 + 户部成本** 三方确定性会审 → 挡雷方案。
 * 小老板辞人最容易踩的雷：无证据/无 PIP 强行辞退 = 违法解除 → 赔 2N（双倍补偿）。本引擎在辞之前显形。
 * 含真中国劳动法逻辑（经济补偿金 N / 代通知金 N+1 / 违法解除赔偿金 2N）。纯函数，缺则标缺不替判。
 */

export type TerminationReason = 'performance' | 'misconduct' | 'redundancy' | 'negotiated' | 'unknown';

export const REASON_CN: Record<TerminationReason, string> = {
  performance: '不能胜任(绩效)',
  misconduct: '严重违纪(过失)',
  redundancy: '裁员(客观情况)',
  negotiated: '协商解除',
  unknown: '未指明',
};

export interface TerminationInput {
  employeeName: string;
  tenureMonths: number | null; // 工龄(月)
  monthlySalary: number | null; // 月薪(元)
  reason: TerminationReason;
  hasEvidence: boolean; // 有无绩效/违纪证据
  hasPIP: boolean; // 有无改进计划(绩效辞退必需)
  noticeGiven: boolean; // 是否提前30天通知
}

export type TerminationVerdict = 'safe' | 'risky' | 'illegal_risk' | 'insufficient';

export const TERMINATION_VERDICT_CN: Record<TerminationVerdict, string> = {
  safe: '合法可行',
  risky: '有风险·按合法路径走',
  illegal_risk: '违法解除高风险·别硬辞',
  insufficient: '缺证·先补',
};

export interface TerminationReview {
  employeeName: string;
  verdict: TerminationVerdict;
  /** 经济补偿金 N（工龄每满1年1个月）。 */
  severanceN: number | null;
  /** 各情形赔付估算。 */
  payout: { legal: number | null; illegalRisk2N: number | null; note: string };
  /** 吏部劳关司：证据/流程。 */
  laborOpinion: string;
  /** 刑部：劳动法风险。 */
  legalRisk: string;
  /** 户部：总成本(补偿+替代招聘)。 */
  costOpinion: string;
  /** 挡雷点（不该硬来的地方）。 */
  blockers: string[];
  /** 合法路径建议。 */
  legalPath: string;
  missing: string[];
}

/** 经济补偿金月数 N：每满1年1个月，6月-1年算1个月，不满6月0.5个月。 */
function severanceMonths(tenureMonths: number): number {
  const years = Math.floor(tenureMonths / 12);
  const rem = tenureMonths % 12;
  return years + (rem >= 6 ? 1 : rem > 0 ? 0.5 : 0);
}

export function reviewTermination(input: TerminationInput): TerminationReview {
  const missing: string[] = [];
  if (input.tenureMonths == null) missing.push('工龄');
  if (input.monthlySalary == null) missing.push('月薪');
  if (input.reason === 'unknown') missing.push('辞退理由');

  const N = input.tenureMonths != null ? severanceMonths(input.tenureMonths) : null;
  const sal = input.monthlySalary;
  const legalPayout = N != null && sal != null ? Math.round((N + (input.noticeGiven ? 0 : 1)) * sal) : null; // N 或 N+1(未通知)
  const illegal2N = N != null && sal != null ? Math.round(2 * N * sal) : null;

  // 风险判定（刑部劳动法逻辑）
  let verdict: TerminationVerdict;
  const blockers: string[] = [];
  let legalRisk: string;
  let legalPath: string;

  if (missing.length > 0) {
    verdict = 'insufficient';
    legalRisk = '缺关键信息，无法评估劳动法风险';
    legalPath = '先补：' + missing.join('、');
  } else if (input.reason === 'misconduct') {
    if (!input.hasEvidence) {
      verdict = 'illegal_risk';
      blockers.push('以违纪辞退却无证据 → 仲裁极可能认定违法解除');
      legalRisk = `🔴 无证据的违纪辞退 = 违法解除，赔 2N ≈ ${illegal2N} 元（双倍）`;
      legalPath = '要么补足违纪证据(制度依据+事实记录+员工签字)，要么改走协商解除(付 N)';
    } else {
      verdict = 'safe';
      legalRisk = '🟢 证据充分的严重违纪辞退，依法可不付补偿（但保留全套证据备仲裁）';
      legalPath = '保全证据链：违纪事实+规章制度依据+告知记录+工会通知';
    }
  } else if (input.reason === 'performance') {
    if (!input.hasPIP || !input.hasEvidence) {
      verdict = 'illegal_risk';
      if (!input.hasPIP) blockers.push('以"不能胜任"辞退却无 PIP/培训调岗记录 → 违法解除');
      if (!input.hasEvidence) blockers.push('无绩效证据');
      legalRisk = `🔴 "不胜任"未经 PIP/调岗直接辞 = 违法解除，赔 2N ≈ ${illegal2N} 元`;
      legalPath = '合法三步：①绩效证据 ②培训或调岗 ③仍不胜任→提前30天通知+付 N+1 ≈ ' + legalPayout + ' 元';
    } else {
      verdict = 'risky';
      legalRisk = `🟡 有 PIP+证据，走"不胜任"解除：付 N+1 ≈ ${legalPayout} 元（合法但仍可能仲裁，证据要硬）`;
      legalPath = '提前30天书面通知 + 付 N+1；或协商解除更稳';
    }
  } else if (input.reason === 'redundancy') {
    verdict = 'risky';
    legalRisk = `🟡 裁员需法定程序(≥20人或≥10%需向劳动部门报告)，付 N ≈ ${N != null && sal != null ? Math.round(N * sal) : '缺'} 元`;
    legalPath = '走法定裁员程序 + 优先留用名单 + 付 N';
  } else {
    // negotiated
    verdict = 'safe';
    legalRisk = `🟢 协商解除风险最低，付 N ≈ ${N != null && sal != null ? Math.round(N * sal) : '缺'} 元 + 签解除协议`;
    legalPath = '签《协商解除协议》(写明已结清，放弃仲裁)，付 N';
  }

  const laborOpinion =
    input.hasEvidence && (input.reason !== 'performance' || input.hasPIP)
      ? '吏部劳关司：证据/流程基本齐'
      : `吏部劳关司：${!input.hasEvidence ? '缺证据' : ''}${input.reason === 'performance' && !input.hasPIP ? '·缺 PIP' : ''}，流程不齐`;

  const costOpinion =
    legalPayout != null
      ? `户部：合法辞退成本 ≈ ${legalPayout} 元（补偿）+ 替代招聘培训成本；硬辞被判违法则 ≈ ${illegal2N} 元`
      : '户部：缺工龄/月薪，成本待算';

  return {
    employeeName: input.employeeName,
    verdict,
    severanceN: N,
    payout: { legal: legalPayout, illegalRisk2N: illegal2N, note: `合法 ${legalPayout ?? '缺'} 元 vs 违法解除 ${illegal2N ?? '缺'} 元` },
    laborOpinion,
    legalRisk,
    costOpinion,
    blockers,
    legalPath,
    missing,
  };
}
