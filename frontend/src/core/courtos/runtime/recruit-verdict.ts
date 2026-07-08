/**
 * 吏部招聘真链 · 裁断句构造(纯逻辑,可测) · 2026-06-22
 *
 * 把吏部人才蜂群 QA 门(`qa_result`)翻成**一句硬裁断**——脊的主角。
 * 铁律(LIBU_DESIGN §那张卡):verdict 单句最大字号,动作/证据下沉。这里只产那句话 + 把握度,
 * 不碰渲染。裁断句的硬判词(准奏/缓奏/不准)由模板控制,天然反"正确的废话"
 * (WEASEL 守门由 recruit-verdict.nodetest 引 chancellor-decision 的 SSOT 钉死)。
 *
 * 诚实:裁断**全程从真 QA 门抬**(建议动作 / hard_checks / issues),不编造。
 * 缺数据 / 未验真时本函数不被调用(BFF 只在 verified+completed 才构 verdict)。
 */

/** 处置基调:驱动徽色与动作可见性。approve=准 / hold=缓 / reject=不准 / unknown=待人工。 */
export type RecruitDisposition = 'approve' | 'hold' | 'reject' | 'unknown';

export interface RecruitVerdict {
  /** 第一行硬判:准奏/缓奏/不准 + 对象 +(缓奏时)首个补证条件。复用 chancellor-decision verdict 范式。 */
  verdict: string;
  /** 0–1 把握度,来自蜂群 QA quality_score(/5 归一);缺则 0.5。 */
  confidence: number;
  /** 准奏前必须补齐的硬缺口:hard_check FAIL + QA issues。空 = 可直接准奏。 */
  mustResolve: string[];
  /** 处置基调。 */
  disposition: RecruitDisposition;
  /** 把握度来源:measured=蜂群真返质量分算出;default=蜂群没给分的兜底(0.5),禁以真把握度出镜。 */
  confidenceSource: 'measured' | 'default';
}

/** 蜂群 QA 门原始形状(外部数据,全部按 unknown 收口再窄化)。 */
interface RawQaResult {
  qa_result?: unknown;
  issues?: unknown;
  verdict_slots?: unknown;
  hard_checks?: unknown;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
}

/** hard_check 内部码 → 老板能裁的人话(P1 dogfood:别把 C2/C4 这种内部码当"缺口"漏给用户)。 */
const CHECK_LABELS: Record<string, string> = {
  C1数字勾稽: '关键数字对不上(编制/薪资/年限前后矛盾)',
  C2需求硬约束命中: '需求硬约束没对上(如薪资与级别、经验与岗位矛盾)',
  C3事实有据: '有结论但缺依据',
  C4结构完整: '方案结构不全(画像/筛选/面试缺环)',
  C5诚实标注: '来源或把握度未如实标注',
};

/** QA 技术噪声(JSON 解析失败/非结构化输出)——禁漏给老板当"招聘缺口"。
 *  会审 M1:只匹配 QA 报错特征组合,不用裸词 JSON/parse(否则误杀"候选人不熟悉 JSON Schema"等合法缺口)。 */
function isQaTechNoise(s: string): boolean {
  return /解析失败|Expecting value|非\s*JSON|从文本推断结果|JSON\s*解析/i.test(s);
}

export function buildRecruitVerdict(qa: unknown, qualityScore: number | null): RecruitVerdict {
  const q = qa as RawQaResult;
  const slots = asRecord(q?.verdict_slots);
  const subjectRaw = typeof slots['对象'] === 'string' ? slots['对象'].trim() : '';
  const subject = subjectRaw.length > 0 ? subjectRaw : '该招聘';
  const action = String(slots['建议动作'] ?? '').toLowerCase();
  const passOk = String(q?.qa_result ?? '').toLowerCase() === 'pass';

  // 缺口可读化(P1 dogfood 发现:不能把 hard_check 内部码 / QA 解析错误原文漏给老板):
  // FAIL 的 check 映射成人话;issues 滤掉技术噪声;若没通过却凑不出可读缺口 → 一句干净兜底。
  const failedChecks = Object.entries(asRecord(q?.hard_checks))
    .filter(([, v]) => String(v).toUpperCase() === 'FAIL')
    .map(([k]) => CHECK_LABELS[k] ?? `岗位要求存在硬性缺口(${k})`); // 会审 LOW:未注册新码也不裸漏内码
  const realIssues = asStringArray(q?.issues).filter((s) => !isQaTechNoise(s));
  const mustResolve = [...failedChecks, ...realIssues];

  // 把握度只在蜂群真返质量分时算"实测";否则兜底 0.5 但标 default,禁以真把握度出镜(会审 MEDIUM)。
  const measured = typeof qualityScore === 'number' && Number.isFinite(qualityScore);
  const confidence = measured ? Math.max(0, Math.min(1, qualityScore / 5)) : 0.5;
  const confidenceSource: RecruitVerdict['confidenceSource'] = measured ? 'measured' : 'default';

  // 处置判定:reject 先于 hold 先于 approve。
  // 会审 HIGH 修:拒绝词必须先吃掉中文「不准/不予/不通过/拒绝/否决/退回」,否则下面 approve 的
  // 「准」会把「不准」误判为准奏(方向性错误——把该拒说成准,最危险)。approve 侧禁用单字「准」
  // (会误命中 标准/准时/基准),改用明确录用词 + passOk 兜底。
  const REJECT = /reject|驳|不予|不通过|不准|拒绝|否决|退回|不录用|不建议/;
  const APPROVE = /approve|通过|准予|准招|准奏|录用|可招|可录|建议招/;
  // 会审 M2:reject 先判并提前返回 —— "不准"无"补齐"语义,mustResolve 清空,
  // 防调用方在不准卡上误显"准奏前先补"(reject + 非空缺口自相矛盾)。
  if (REJECT.test(action)) {
    return {
      verdict: `不准：${subject}方案不达标${realIssues[0] ? `——${realIssues[0]}` : ''}`,
      confidence,
      mustResolve: [],
      disposition: 'reject',
      confidenceSource,
    };
  }
  // 没通过却凑不出可读缺口 → 干净兜底(仅 hold 路径需要;reject 已提前返回,approve 不进此支)。
  if (!passOk && mustResolve.length === 0) {
    mustResolve.push('岗位画像与硬性标准(需求太含糊或 QA 未能裁断)');
  }

  let disposition: RecruitDisposition;
  let verdict: string;
  if (!passOk || mustResolve.length > 0) {
    disposition = 'hold';
    verdict = `缓奏：${subject}，先补齐${mustResolve[0] ?? '关键缺口'}`;
  } else if (APPROVE.test(action) || passOk) {
    disposition = 'approve';
    verdict = `准奏：${subject}方案可用，可进面试`;
  } else {
    disposition = 'unknown';
    verdict = `${subject}：待人工研判`;
  }

  return { verdict, confidence, mustResolve, disposition, confidenceSource };
}
