/**
 * 工部 PACK 方案 → 盖章技术呈奏（2026-06-29）
 *
 * 设计↔真引擎的桥（工部版，对标户部 bom-cost-document）。
 * 诚实边界（铁律9）：真实 PACK sizing/成本拆分是后端 jiqun pack_rd 蜂群（async），
 * 前端只有：① LIVE 派发凭证(sourceLabel/trace_id) ② 选型初筛(咨询·真) ③ 治理锁。
 * 所以呈奏如实标：已派发真蜂群(真)+选型初筛(真)+真实sizing待后端回填(缺)，绝不编 sizing 数字。
 */

import type { SourceLabel } from '@/core/courtos/types';
import type { OfficialDocumentProps, DocEvidence } from '@/components/OfficialDocument';

export interface PackDocInput {
  /** PACK 需求原文（如「60V32Ah 三轮电池包·低温-20℃」）。 */
  requirement: string;
  /** 派发回执来源标：LIVE_SWARM=真派发后端蜂群。 */
  sourceLabel: SourceLabel;
  traceId?: string;
  /** 选型初筛（咨询·真）：温度/化学体系筛出的候选电芯。 */
  selectedCells?: { model: string; spec: string }[];
  /** 治理锁（工部禁直接对外承诺的项，gongbu-engines.productionLocks）。 */
  productionLocks?: string[];
  /** 真实 sizing/成本是否已由后端回填（false=仍 async pending）。 */
  resultFilled?: boolean;
}

export interface PackDocMeta {
  docNo: string;
  date: string;
  handler: string;
  reviewers?: string[];
}

const isLive = (s: SourceLabel): boolean => s === 'LIVE_SWARM' || s === 'LIVE';

/** 工部 PACK → 技术呈奏 props（诚实:已派发真蜂群+选型初筛真,真实sizing待回填标缺,不编数字）。 */
export function packToDocument(input: PackDocInput, meta: PackDocMeta): OfficialDocumentProps {
  const { requirement, sourceLabel, traceId, selectedCells = [], productionLocks = [], resultFilled = false } = input;
  const live = isLive(sourceLabel);

  const dispatchLine = live
    ? `已派发后端 jiqun pack_rd 蜂群真算（${sourceLabel}${traceId ? `·trace ${traceId}` : ''}）`
    : `派发未达真蜂群（${sourceLabel}）——真实 sizing 无法取得，请勿据此对外`;

  const bluf = live
    ? `${requirement} 的 PACK 方案${dispatchLine}。前端已完成选型初筛（${selectedCells.length} 款候选电芯），真实 PACK 配置、成本拆分与报价由后端蜂群计算${resultFilled ? '并已回填' : '中（待回填，未回填前禁对外报价）'}。`
    : `${requirement}：${dispatchLine}。工部不替后端编 sizing/成本，待真蜂群可达后重派。`;

  const evidence: DocEvidence[] = [
    { text: dispatchLine, source: live ? 'real' : 'missing' },
    ...selectedCells.map((c): DocEvidence => ({ text: `选型初筛：${c.model}（${c.spec}）— 工部底座查规格(咨询)`, source: 'real' })),
    {
      text: '真实 PACK sizing / 成本拆分 / 报价 — 后端 jiqun pack_rd 蜂群产出（铁律9）',
      source: resultFilled ? 'real' : 'missing',
    },
  ];

  const sections = [
    { heading: '需求与边界', body: `${requirement}。按铁律9，工部前端只做选型初筛与派发；真实 sizing/成本/报价归后端 pack_rd 蜂群，工部不在前端重算。` },
    {
      heading: '处置与建议',
      body: live
        ? [
            `已派发真蜂群（${sourceLabel}），选型初筛 ${selectedCells.length} 款候选。`,
            resultFilled ? '后端 sizing/成本已回填，见分析与依据。' : '真实 sizing/成本待后端回填——回填前本呈奏不构成报价依据。',
          ]
        : ['派发未达真蜂群，先恢复后端连通再议，工部不替估。'],
    },
  ];

  const risks = [
    '工部禁在前端直接对外承诺 PACK 报价/交期（铁律9）；真实数字以后端蜂群回填为准。',
    ...(resultFilled ? [] : ['真实 sizing/成本尚未回填，据此对外有失真风险。']),
    ...productionLocks.map((l) => `产线锁：${l}`),
  ];

  const nextSteps = [
    live && !resultFilled ? '轮询后端蜂群结果，回填真实 sizing/成本后再呈复核。' : '据后端回填结果，户部核成本、兵部测报价后联审。',
    '质门：真实 sizing/成本齐 + 毛利过红线，方可呈老板朱批对外。',
  ];

  return {
    deptName: '工部',
    deptKind: '研发专用章',
    docNo: meta.docNo,
    classification: '内部·商密',
    date: meta.date,
    title: `关于「${requirement}」PACK 技术方案的呈奏`,
    bluf,
    sections,
    evidence,
    risks,
    nextSteps,
    handler: meta.handler,
    reviewers: meta.reviewers ?? ['户部·成本司', '兵部·销售司'],
  };
}
