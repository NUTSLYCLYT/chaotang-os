/**
 * 工部 PACK 可行性会诊真链 · 诚实 envelope + 出参剥离(纯逻辑,可测) · 2026-06-22
 *
 * 复刻吏部 recruit-envelope 的诚实闸,但多一道工部命门(GONGBU_DESIGN §13.2#9):
 *   pack_rd 蜂群整包返回 BOM成本/报价/供应商/毛利/交期承诺 = **真实产线资产**。
 *   会诊台是咨询面,**绝不能把这些渲染成"可采纳裁断"**(老板一点采纳=默认了一份对外报价)。
 *   所以 result 侧必须 stripProductionFields:产线资产字段整体上锁(只留"转后端军机处确认"),
 *   只放行定性可行性字段(能不能造/BMS选型定性/工艺/结构热设计)。
 * 诚实闸:验真过才 LIVE_SWARM,否则 FALLBACK 不冒充。本纯函数被 nodetest 钉死。
 */
import type { SourceLabel } from '../types';
import type { EvidenceBoundSwarmRun } from './evidence-bound-swarm-run';
import type { ReverifyResult } from './reverify-swarm-trace.ts';

export interface FeasibilityEnvelope {
  success: boolean;
  sourceLabel: SourceLabel;
  trace_id: string | null;
  status: 'running' | 'failed';
  confidence: number;
  missingEvidence: string[];
  reverifyReason: string;
  message: string;
  evidenceBoundRun?: EvidenceBoundSwarmRun;
}

export interface FeasibilityInput {
  jiqunOk: boolean;
  sessionId: string | null;
  reverify: ReverifyResult | null;
  httpDetail?: string;
  evidenceBoundRun?: EvidenceBoundSwarmRun;
}

export function buildFeasibilityEnvelope(input: FeasibilityInput): FeasibilityEnvelope {
  if (!input.jiqunOk || !input.sessionId) {
    return {
      success: false,
      sourceLabel: 'FALLBACK',
      trace_id: null,
      status: 'failed',
      confidence: 0,
      evidenceBoundRun: input.evidenceBoundRun,
      missingEvidence: ['jiqun PACK研发蜂群未返回可追踪 session'],
      reverifyReason: input.httpDetail ?? 'jiqun /api/swarm/run 未返回 session',
      message: '后端蜂群未启动,降级 FALLBACK(诚实:非真链)',
    };
  }
  const verified = input.reverify?.verified === true;
  const sourceLabel: SourceLabel = verified ? 'LIVE_SWARM' : 'FALLBACK';
  return {
    success: true,
    sourceLabel,
    trace_id: input.sessionId,
    status: 'running',
    confidence: verified ? 0.85 : 0.4,
    evidenceBoundRun: input.evidenceBoundRun,
    missingEvidence: verified ? [] : ['trace 未通过后端兑现核对,降级 FALLBACK'],
    reverifyReason: input.reverify?.reason ?? '未验真',
    message: verified
      ? 'PACK研发蜂群已真启动,session 可向后端兑现(LIVE_SWARM)'
      : '蜂群 session 未能兑现,降级 FALLBACK(不冒充真)',
  };
}

/**
 * 出参剥离命门(§13.2#9):pack_rd 整包产出里,凡触及真实产线资产(报价/成本/供应商/毛利/交期)
 * 的字段一律整体上锁——不渲染其内容(连"缺证"细节也不上会诊台,因为字段本身=产线资产),
 * 只回字段名 + 转后端提示。其余定性可行性字段放行供老板看"能不能造"。
 * 整字段锁(而非从散文里抠数字):产线数字藏在自由文本里,surgical 抠不干净,整锁才安全。
 */
const PRODUCTION_ASSET_MARKERS = [
  '成本',
  '报价',
  '售前成本',
  'BOM',
  '供应链',
  '供应商',
  '毛利',
  '交期',
  '价格',
  '采购',
];

export function isProductionAssetField(fieldName: string): boolean {
  return PRODUCTION_ASSET_MARKERS.some((marker) => fieldName.includes(marker));
}

export interface StrippedFeasibility {
  /** 放行的定性可行性字段(能不能造/选型定性/工艺) */
  consult: Record<string, string>;
  /** 被锁的产线资产字段名(只露名字 + 转后端,不露内容) */
  lockedProductionFields: string[];
}

export function stripProductionFields(
  finalOutput: Record<string, unknown> | null | undefined,
): StrippedFeasibility {
  const consult: Record<string, string> = {};
  const lockedProductionFields: string[] = [];
  if (!finalOutput || typeof finalOutput !== 'object') {
    return { consult, lockedProductionFields };
  }
  for (const [field, body] of Object.entries(finalOutput)) {
    if (isProductionAssetField(field)) {
      lockedProductionFields.push(field);
    } else {
      consult[field] = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }
  return { consult, lockedProductionFields };
}
