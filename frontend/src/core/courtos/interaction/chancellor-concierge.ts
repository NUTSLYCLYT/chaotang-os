/**
 * ChancellorConcierge（V3 Prompt 4/9）：丞相像顶级秘书长，把一句话整理成可执行拟旨卡。
 * 结论先行、不奉承、缺证就说缺证、高风险提前提示人工确认。mock/规则版。
 */
import type { SourceLabel } from '../types.ts';
import type { NextBestAction } from './interaction-types.ts';

export interface ChancellorDraftInput {
  rawQuestion: string;
  sourceLabel?: SourceLabel;
}

export type RecommendedPath = 'shangshufang_direct' | 'junjichu_review' | 'secret_edict' | 'need_more_background';

export interface ChancellorDraftCard {
  original: string;
  refinedIntent: string;
  decisionGoal: string;
  knownInfo: string[];
  gaps: string[];
  riskPreview: string[];
  suggestedPerspectives: string[];
  recommendedPath: RecommendedPath;
  nextAction: NextBestAction;
  sourceLabel: SourceLabel;
}

const HIGH_RISK = ['股权', '合同', '独家', '预付款', '保证收益', '正式报价', '供应商锁定', '违约', '签字', '法务'];

export function buildChancellorDraftCard(input: ChancellorDraftInput): ChancellorDraftCard {
  const q = (input.rawQuestion ?? '').trim().replace(/\s+/g, ' ');
  const sourceLabel = input.sourceLabel ?? 'MIXED';

  const perspectives: string[] = [];
  if (/ROI|预算|成本|报价|现金|回本|利润/.test(q)) perspectives.push('户部');
  if (HIGH_RISK.some((k) => q.includes(k))) perspectives.push('刑部');
  if (/客户|销售|渠道|成交|竞争|招商/.test(q)) perspectives.push('兵部');
  if (/话术|品牌|对外|宣传/.test(q)) perspectives.push('礼部');
  if (/技术|产品|BOM|交付|供应链|验收/.test(q)) perspectives.push('工部');
  if (/负责人|组织|责任|执行|招聘|绩效|辞退|调岗|提成/.test(q)) perspectives.push('吏部');
  if (perspectives.length === 0) perspectives.push('户部', '刑部');

  const isHigh = HIGH_RISK.some((k) => q.includes(k));

  const gaps: string[] = [];
  if (/招聘|招人/.test(q)) gaps.push('薪酬预算', '90天目标', '试用期成功标准');
  if (/ROI|投资|合作/.test(q)) gaps.push('投入预算', 'ROI 假设', '最坏情况');
  if (gaps.length === 0) gaps.push('关键证据待补');

  const recommendedPath: RecommendedPath =
    !q || q.length < 5 ? 'need_more_background' : isHigh ? 'junjichu_review' : 'shangshufang_direct';

  const nextAction: NextBestAction = isHigh
    ? { actionId: 'human_confirm', label: '人工确认', reason: '涉及高风险，不会替你直接采纳，需人工确认。' }
    : { actionId: 'confirm_and_start', label: '确认发起', reason: '拟旨已就绪，确认后进入军机处会审。' };

  return {
    original: q,
    refinedIntent: q
      ? `请就「${q}」给出可裁决判断（准奏/补证/复核/驳回），核查事实来源、证据缺口、风险边界与唯一下一步。`
      : '',
    decisionGoal: '输出准奏 / 补证 / 复核 / 驳回 建议。',
    knownInfo: q ? [`用户原问：${q}`] : [],
    gaps,
    riskPreview: isHigh ? ['涉及股权/合同/付款等高风险，后续需人工确认。'] : [],
    suggestedPerspectives: [...new Set(perspectives)],
    recommendedPath,
    nextAction,
    sourceLabel,
  };
}
