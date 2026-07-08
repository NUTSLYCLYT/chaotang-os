/**
 * 统一「外部数据对接口子」+ 内外对比契约（2026-06-28）
 *
 * 用户原则：记账/ERP/税务/审计 都要**预留外部数据对接口子**（现在不接、留口子），
 * 且能**和外部数据形成对比**（内部真实数据 vs 外部行业/同行）。
 * 所有司（引擎司/顾问司）按此统一 shape：留 connector + 做内外对比，缺则诚实标、不编。
 * 接通后的外部数据，必须挂数据分级（对接你的"来源四级"，T3 原始禁直用）。
 */

export type ExternalSourceKind =
  | 'bookkeeping' // 代账软件/账本（记账司）
  | 'erp' // ERP（成本/库存/订单）
  | 'tax_authority' // 金税/税务系统（税务司）
  | 'bank' // 银行流水（出纳/资金司）
  | 'industry_benchmark' // 行业基准（锦衣卫核实 → 内外对比）
  | 'audit_log'; // 审计/内控日志（审计司）

/** 数据分级（对接来源四级；T3 原始禁直用，须核实+人工确认升级）。 */
export type DataGrade = 'T0_dept' | 'T1_upload' | 'T2_verified' | 'T3_raw';

/** 司预留的外部口子（connected:false = 仅留口子，诚实标"未接"）。 */
export interface ExternalConnector {
  kind: ExternalSourceKind;
  connected: boolean;
  grade: DataGrade | null;
  note: string;
}

const CONNECTOR_NOTES: Record<ExternalSourceKind, string> = {
  bookkeeping: '口子已留：未来接代账软件/账本 → 自动取真账目',
  erp: '口子已留：未来接 ERP → 取订单/库存/成本',
  tax_authority: '口子已留：未来接金税/税务系统 → 取真实税负',
  bank: '口子已留：未来接银行流水 → 取真现金',
  industry_benchmark: '口子已留：未来接锦衣卫核实的行业基准 → 内外对比',
  audit_log: '口子已留：未来接审计/内控日志 → 合规核查',
};

/** 各司按需预留口子（默认 connected:false，诚实"未接"）。 */
export function reserveConnectors(kinds: ExternalSourceKind[]): ExternalConnector[] {
  return kinds.map((kind) => ({ kind, connected: false, grade: null, note: CONNECTOR_NOTES[kind] }));
}

/** 每个司默认该留哪些口子（记账/ERP/税务/审计 等）。 */
export const DEPT_CONNECTOR_PRESET: Record<string, ExternalSourceKind[]> = {
  accountant: ['bookkeeping', 'erp'], // 会计/记账
  cashier: ['bank', 'bookkeeping'], // 出纳
  treasury: ['bank'], // 资金
  cost_pricing: ['erp', 'industry_benchmark'], // 成本定价
  tax: ['tax_authority'], // 税务
  audit_control: ['audit_log', 'bookkeeping'], // 审计
  investment: ['industry_benchmark'], // 投资（对比行业 IRR）
  budget: ['bookkeeping'], // 预算
};

export interface ExternalComparison {
  metric: string;
  internal: number | null;
  external: number | null;
  externalSource: ExternalSourceKind | null;
  verdict: 'above' | 'below' | 'inline' | 'no_external' | 'no_internal';
  note: string;
}

/**
 * 内外对比（纯函数）：内部真实数据 vs 外部行业/同行。
 * 无外部 → 诚实"口子已留待接"；无内部 → "先上传"。绝不编一个对比。
 */
export function compareInternalExternal(
  metric: string,
  internal: number | null,
  external: number | null,
  externalSource: ExternalSourceKind | null,
  unit = '%',
): ExternalComparison {
  if (internal == null) {
    return { metric, internal, external, externalSource, verdict: 'no_internal', note: `${metric}：缺内部真实数据，先上传` };
  }
  if (external == null) {
    return { metric, internal, external, externalSource, verdict: 'no_external', note: `${metric}：你 ${internal}${unit}，暂无外部基准（口子已留，待接行业数据）` };
  }
  const verdict = internal > external * 1.05 ? 'above' : internal < external * 0.95 ? 'below' : 'inline';
  const cn = verdict === 'above' ? '高于' : verdict === 'below' ? '低于' : '持平';
  return { metric, internal, external, externalSource, verdict, note: `${metric}：你 ${internal}${unit} vs 外部 ${external}${unit} → ${cn}同行` };
}
