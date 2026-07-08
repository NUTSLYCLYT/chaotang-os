/**
 * 户部 BOM 成本 → 盖章呈奏公文（2026-06-29）
 *
 * 设计↔真引擎的桥：把 analyzeBomCost 的真实输出，套《朝堂公文与用印标准》渲染为正式公文。
 * 纯函数·无副作用——真成本进，公文 props 出；BLUF 结论先行，证据带三色来源标，缺证诚实。
 */

import type { BomCost } from './bom-cost';
import type { OfficialDocumentProps, DocEvidence } from '@/components/OfficialDocument';

export interface BomDocMeta {
  docNo: string;
  date: string;
  handler: string;
  reviewers?: string[];
}

const fmt = (n: number): string => Math.round(n).toLocaleString('zh-CN');

/** 真 BOM 成本核算 → 户部呈奏公文 props（结论先行·三色证据·缺证诚实）。 */
export function bomCostToDocument(cost: BomCost, meta: BomDocMeta): OfficialDocumentProps {
  const { product, totalCost, topCostDriver, breakdown, missing } = cost;
  const driverAmount = topCostDriver
    ? breakdown.find((b) => b.name === topCostDriver.name)?.amount ?? null
    : null;

  // BLUF：结论先行
  let bluf: string;
  if (totalCost != null) {
    bluf = `经核定，${product}单台直接物料成本 ${fmt(totalCost)} 元`;
    if (topCostDriver) {
      const amt = driverAmount != null ? `（${fmt(driverAmount)} 元）` : '';
      bluf += `，其中${topCostDriver.name}占比 ${topCostDriver.pct}%${amt}为成本主导项，建议以其议价为降本第一杠杆`;
    }
    bluf += '。';
    if (missing.length) bluf += `本核定尚缺 ${missing.length} 项数据（见缺证），补齐后方为定论。`;
  } else {
    bluf = `${product} 成本暂无法核定——${missing.join('、') || '缺关键数据'}。户部不替你估，请补齐后再呈。`;
  }

  // 证据：真实成本项带"真"标，缺项带"缺"标
  const evidence: DocEvidence[] = [
    ...breakdown.map((b): DocEvidence => ({
      text: `${b.name} ${fmt(b.amount)} 元（占 ${b.pct}%）— 取自真实 BOM 核算`,
      source: 'real',
    })),
    ...missing.map((m): DocEvidence => ({ text: `${m} — 待补`, source: 'missing' })),
  ];

  const sections = [
    { heading: '背景与问题', body: `核定 ${product} 标准 BOM 真实物料成本，作为对外报价与毛利测算的底座。` },
    {
      heading: '结论与建议',
      body: totalCost != null
        ? [
            `单台直接物料成本 ${fmt(totalCost)} 元，构成见分析与依据。`,
            topCostDriver
              ? `${topCostDriver.name}为成本主导（${topCostDriver.pct}%），降本须从其集采议价入手，责任人：户部采购司。`
              : '各项成本较均衡，降本需综合施策。',
          ]
        : ['成本未核定，先补齐缺证项再议。'],
    },
  ];

  const risks = [
    '对外报价属高风险事项（铁律13.2.5），未过户部+兵部联审人工确认门前，禁一键对外。',
    ...(missing.length ? [`尚有 ${missing.length} 项数据缺失，据此报价有低估风险。`] : []),
  ];

  const nextSteps = [
    ...(topCostDriver ? [`户部采购司就${topCostDriver.name}出集采议价方案。`] : []),
    '兵部据核定成本测算分档报价，回户部联审。',
    '质门：报价毛利 ≥ 设定红线且证据齐全，方可呈老板朱批对外。',
  ];

  return {
    deptName: '户部',
    deptKind: '财政专用章',
    docNo: meta.docNo,
    classification: '内部·商密',
    date: meta.date,
    title: `关于${product} BOM 成本核定的呈奏`,
    bluf,
    sections,
    evidence,
    risks,
    nextSteps,
    handler: meta.handler,
    reviewers: meta.reviewers ?? ['兵部·销售司', '军机处会审'],
  };
}
