/**
 * 史馆卷宗 · CourtDoc(archive) 类型 + 诚实渲染规则
 *
 * 真相源：jiqun_ai_fresh docs/frontend_ui/shiguan.md（字段映射/状态规范）
 *         jiqun_ai_fresh docs/dept_design/shiguan.md（§4.1 court_doc archive JSON 样例）
 *
 * 后端现状（2026-07-06 核实）：archive_manager.py 只是 CLI 脚本，truth_ledger.health() /
 * signoff_learning.health() 只是 Python 函数——jiqun 后端**未暴露** /api/archive/{case,list,
 * flywheel/health,export} 任一 HTTP 路由。本文件的 MOCK_COURT_DOCS 是按 court_doc 契约手填的
 * 示例，用于把「诚实渲染规则」先跑起来；真接口就绪后只需替换数据源，渲染规则不用改。
 */

export type CourtDocLight = 'green' | 'yellow' | 'red' | 'black';
export type CourtDocGate = 'passed' | 'pending' | 'blocked' | 'n/a';
export type CourtDocGrounding = 'rag' | 'deterministic' | 'none';
export type CourtDocSourceLabel = 'LIVE' | 'LIVE_SWARM' | 'MIXED' | 'FALLBACK' | 'DEMO';
export type EvidenceAuth = 'authenticated' | 'orphan' | 'unknown';
export type CourtDocAction = 'open_annals' | 'trace_evidence' | 'feed_flywheel' | 'export_amulet';

export interface CourtDocItem {
  level: 'green' | 'yellow' | 'red';
  title: string;
  odds: string | null;
  impact: string | null;
  fix: string | null;
  /** null → 无源，渲染纪律禁止绿灯 */
  evidenceRef: string | null;
}

export interface CourtDocProvenance {
  advisors: string[];
  grounding: CourtDocGrounding;
  gate: CourtDocGate;
}

export interface CourtDoc {
  caseId: string;
  light: CourtDocLight;
  headline: string;
  shielded: string | null;
  items: CourtDocItem[];
  actions: CourtDocAction[];
  provenance: CourtDocProvenance;
  sourceLabel: CourtDocSourceLabel;
  signed: boolean;
  sealedArchive: string | null;
}

/** 灯色 → 边框/文字色（照搬 light 字段，不美化） */
export const LIGHT_COLOR: Record<CourtDocLight, string> = {
  green: '#3DD68C',
  yellow: '#F5A524',
  red: '#F43F5E',
  black: '#7A8199',
};

export const LIGHT_LABEL: Record<CourtDocLight, string> = {
  green: '已封存 · 依据齐全',
  yellow: '待复核',
  red: '存在风险',
  black: '已落刑部深查',
};

export const AUTH_COLOR: Record<EvidenceAuth, string> = {
  authenticated: '#3DD68C',
  orphan: '#F43F5E',
  unknown: '#7A8199',
};

export const AUTH_LABEL: Record<EvidenceAuth, string> = {
  authenticated: '可信',
  orphan: '疑似脏源 · 勿采信',
  unknown: '未鉴权',
};

/**
 * 诚实渲染核心闸：宁可显式"待考"，不可静默美化成绿灯。
 * 命中任一条件即视为"无法确认"，UI 一律走灰色待考分支。
 */
export function isUnverifiable(doc: Pick<CourtDoc, 'provenance'>, item?: Pick<CourtDocItem, 'evidenceRef'>): boolean {
  if (item && item.evidenceRef === null) return true;
  if (doc.provenance.grounding === 'none') return true;
  return false;
}

export function isPendingGate(doc: Pick<CourtDoc, 'provenance'>): boolean {
  return doc.provenance.gate === 'pending';
}

export function isBlockedGate(doc: Pick<CourtDoc, 'provenance'>): boolean {
  return doc.provenance.gate === 'blocked';
}

export function canExportAmulet(doc: Pick<CourtDoc, 'signed' | 'sourceLabel' | 'provenance'>): boolean {
  if (!doc.signed) return false;
  if (doc.sourceLabel === 'FALLBACK' || doc.sourceLabel === 'DEMO') return false;
  if (isPendingGate(doc) || isBlockedGate(doc)) return false;
  return true;
}

/** evidence_ref scheme 解析结果 */
export type EvidenceResolution =
  | { kind: 'truth_ledger'; caseId: string; auth: EvidenceAuth; raw: string }
  | { kind: 'annals'; period: string; raw: string }
  | { kind: 'flywheel_health'; raw: string }
  | { kind: 'unresolvable'; raw: string | null };

export function resolveEvidenceRef(ref: string | null): EvidenceResolution {
  if (!ref) return { kind: 'unresolvable', raw: null };
  const truthMatch = /^truth:\/\/shiguan\/([^#]+)#(authenticated|orphan|unknown)$/.exec(ref);
  if (truthMatch) {
    return { kind: 'truth_ledger', caseId: truthMatch[1]!, auth: truthMatch[2] as EvidenceAuth, raw: ref };
  }
  const annalsMatch = /^annals:\/\/shiguan_annals\/(.+)$/.exec(ref);
  if (annalsMatch) {
    return { kind: 'annals', period: annalsMatch[1]!, raw: ref };
  }
  if (ref === 'truth://flywheel/health') {
    return { kind: 'flywheel_health', raw: ref };
  }
  return { kind: 'unresolvable', raw: ref };
}

/**
 * 示例卷宗（按 court_doc 契约手填，非真实归档）。
 * 覆盖三种诊断态：SG-031 正常（可导护身符）、SG-032 gate=pending + evidence_ref=null（禁绿禁导）、
 * SG-033 source=FALLBACK + signed=false（禁导护身符，需水印）。
 */
export const MOCK_COURT_DOCS: CourtDoc[] = [
  {
    caseId: 'SG-20260701-031',
    light: 'green',
    headline: '已封存：储能售后召回决策卷宗 —— 当时依据齐全，判赔合理可保命',
    shielded: '史馆为你留底：这单决策的全部当时依据 + 御史签字，日后追责可一键调取',
    items: [
      { level: 'green', title: '决策依据完整', odds: null, impact: null, fix: '无需补', evidenceRef: 'truth://shiguan/SG-20260701-031#authenticated' },
      { level: 'yellow', title: '成交率明细缺 per-case 数据', odds: '中', impact: '复盘失真', fix: '补回各主因数量再算占比，当前标"待考"', evidenceRef: 'annals://shiguan_annals/2026Q2' },
      { level: 'green', title: '教训已喂飞轮', odds: null, impact: null, fix: 'failure_memory + signoff_learning 已写入，下次同部规避', evidenceRef: 'truth://flywheel/health' },
    ],
    actions: ['open_annals', 'trace_evidence', 'feed_flywheel', 'export_amulet'],
    provenance: { advisors: ['deming', 'andrew-ng', 'charity-majors', 'karpathy', 'jeff-bezos-perspective'], grounding: 'rag', gate: 'passed' },
    sourceLabel: 'LIVE_SWARM',
    signed: true,
    sealedArchive: 'SG-20260701-031',
  },
  {
    caseId: 'SG-20260703-032',
    light: 'yellow',
    headline: '待复核：供应商锁定条款卷宗 —— 御史闸未过，禁作定论',
    shielded: null,
    items: [
      { level: 'yellow', title: '独家条款风险未评级', odds: null, impact: null, fix: null, evidenceRef: null },
      { level: 'red', title: '违约金上限缺法条依据', odds: '高', impact: '追责时空口无凭', fix: '补法条编号再定级', evidenceRef: null },
    ],
    actions: ['open_annals', 'trace_evidence'],
    provenance: { advisors: ['charity-majors'], grounding: 'none', gate: 'pending' },
    sourceLabel: 'LIVE_SWARM',
    signed: false,
    sealedArchive: null,
  },
  {
    caseId: 'SG-20260704-033',
    light: 'red',
    headline: '演示数据：跨境合规卷宗（非真实封存）',
    shielded: null,
    items: [
      { level: 'red', title: '跨境数据出境未评估', odds: '高', impact: '监管处罚', fix: '补跨境合规评估', evidenceRef: 'truth://shiguan/SG-20260704-033#orphan' },
    ],
    actions: ['open_annals'],
    provenance: { advisors: [], grounding: 'none', gate: 'blocked' },
    sourceLabel: 'FALLBACK',
    signed: false,
    sealedArchive: null,
  },
];
