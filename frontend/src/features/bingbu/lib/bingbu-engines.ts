/**
 * 兵部 · 销售决策引擎（视图适配 · 纯函数 · 2026-06-27）
 *
 * 镜像户部 `hubu-engines.ts` 的 evaluateProject，但**不重写销售判断逻辑**——
 * 复用已接入主决策环(unified-decision-loop)的 CRO 销售引擎
 * `runBingbuCROSalesOfficeReview` + `evaluateBingbuQualityGate`（铁律2 SSOT / 铁律9：
 * 不在前端自建第二套销售逻辑）。本文件只做「引擎输出 → 卡片视图模型」的纯映射，
 * 让兵部驾驶舱拿到与户部 HubuEvaluation 同构的 API。
 *
 * 命门纪律（同户部）：有文本→真判；缺证→显性 missing，裁决自然落「补证/复核」，绝不编。
 */
import {
  runBingbuCROSalesOfficeReview,
  evaluateBingbuQualityGate,
} from '@/core/courtos/bingbu/bingbu-cro-sales-office';
import type {
  BingbuCROOpinion,
  BingbuCROPosition,
  BingbuSalesRevenueQuestionType,
  BingbuCrossDepartmentReview,
} from '@/core/courtos/bingbu/bingbu-types';
import type { UnifiedSignal } from '@/core/courtos/unified/unified-types';
import type { BingbuSalesItem } from '@/lib/contracts/bingbu-sales';

export const SALES_POSITION_CN: Record<BingbuCROPosition, string> = {
  推进: '推进',
  补证: '补证',
  复核: '升维复核',
  // 止损 = 预留位：CRO 引擎当前只产出 推进/补证/复核 三态；若将来引入止损，
  // 需同步在 evaluateBingbuQualityGate 的 signal 推导补 止损→RED 分支（会审 MEDIUM 记录）。
  止损: '止损',
};

export const SALES_QUESTION_TYPE_CN: Record<BingbuSalesRevenueQuestionType, string> = {
  LEAD_QUALIFICATION: '线索甄别',
  OPPORTUNITY_REVIEW: '商机复盘',
  ACCOUNT_STRATEGY: '大客户策略',
  QUOTE_STRATEGY: '报价策略',
  NEGOTIATION_STRATEGY: '谈判策略',
  CHANNEL_PARTNER: '渠道伙伴',
  FORECAST_REVIEW: '预测复盘',
  WIN_LOSS_REVIEW: '输赢复盘',
  CUSTOMER_SUCCESS_GROWTH: '客户成功/增长',
  SALES_ORG_EXECUTION: '销售组织执行',
};

const CROSS_REVIEW_CN: Record<BingbuCrossDepartmentReview, string> = {
  finance: '户部',
  justice: '刑部',
  ritual: '礼部',
  jinyiwei: '锦衣卫',
  personnel: '吏部',
  works: '工部',
};

/** 兵部裁决灯：由 CRO 引擎质门 signal + position 驱动（真信号）。 */
export const SALES_SIGNAL_LIGHT: Record<UnifiedSignal, { dot: string; label: string }> = {
  GREEN: { dot: '#5FB97A', label: '可推进 · 证据足' },
  YELLOW: { dot: '#E5B84D', label: '补证 / 待校验' },
  RED: { dot: '#E5604D', label: '升维复核 · 先别外发' },
  GRAY: { dot: '#8B93A7', label: '来源不实 · 不作依据' },
};

export interface BingbuSalesEvaluation {
  position: BingbuCROPosition;
  positionCn: string;
  signal: UnifiedSignal;
  signalLabel: string;
  questionType: BingbuSalesRevenueQuestionType;
  questionTypeCn: string;
  /** 缺哪些证据（显性，禁静默）。 */
  missing: string[];
  /** 需哪些部门跨审（中文名）。 */
  crossReviews: string[];
  /** 唯一销售下一步。 */
  nextAction: string;
  /** 高风险销售动作是否需人工确认。 */
  humanConfirmationRequired: boolean;
  /** 随卡注解：字段 → 一句人话（grounded 在该卡真判断上）。 */
  explain: { type: string; position: string; cross: string; gate: string };
}

/**
 * evaluateSalesItem —— 把一条销售事项喂给 CRO 引擎，返回卡片视图模型。
 * 输入文本 = command 优先（用户原话），退化用 title。sourceLabel 固定 LIVE
 * （咨询态、纯前端可算；真实报价/对外承诺转后端 jiqun，铁律9）。
 */
/**
 * salesOpinionForItem —— 返回 CRO 引擎完整意见（详情面板用：subOfficeReviews/生成物/问询）。
 * 与 evaluateSalesItem 同源同输入，供右栏深挖；不重复造判断。
 */
export function salesOpinionForItem(item: BingbuSalesItem): BingbuCROOpinion {
  const text = item.command?.trim() || item.title;
  return runBingbuCROSalesOfficeReview({ text, sourceLabel: 'LIVE' });
}

export function evaluateSalesItem(item: BingbuSalesItem): BingbuSalesEvaluation {
  const text = item.command?.trim() || item.title;
  const opinion = runBingbuCROSalesOfficeReview({ text, sourceLabel: 'LIVE' });
  const gate = evaluateBingbuQualityGate(opinion);

  const crossReviewsCn = opinion.crossDepartmentReviews.map((id) => CROSS_REVIEW_CN[id]);
  const positionCn = SALES_POSITION_CN[opinion.position];
  const questionTypeCn = SALES_QUESTION_TYPE_CN[opinion.salesRevenueQuestionType];

  return {
    position: opinion.position,
    positionCn,
    signal: gate.signal,
    signalLabel: SALES_SIGNAL_LIGHT[gate.signal].label,
    questionType: opinion.salesRevenueQuestionType,
    questionTypeCn,
    missing: opinion.missingEvidence,
    crossReviews: crossReviewsCn,
    nextAction: opinion.onePrimarySalesAction,
    humanConfirmationRequired: opinion.humanConfirmationRequired,
    explain: {
      type: `兵部识别为「${questionTypeCn}」类销售问题，据此选司、定缺证清单`,
      position:
        opinion.position === '复核'
          ? '裁为「升维复核」：触及报价/承诺/对外表达/法律，须跨部门核验，不得自动外发'
          : opinion.position === '补证'
            ? `裁为「补证」：缺 ${opinion.missingEvidence.length} 项关键证据，先补齐再推进`
            : opinion.position === '止损'
              ? '裁为「止损」：当前态势不利，建议收缩或退出'
              : '裁为「推进」：证据与责任人到位，可执行唯一下一步',
      cross: crossReviewsCn.length
        ? `需 ${crossReviewsCn.join('、')} 跨审——销售结论触碰其域，单兵部不背书`
        : '本事项不触发跨部门复核',
      gate: `质门 ${gate.signal}/${gate.verdict}${gate.blockingIssues.length ? `：阻断 ${gate.blockingIssues.join('、')}` : '：无阻断项'}`,
    },
  };
}
