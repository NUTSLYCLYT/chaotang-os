import { AGENT_META, type AgentCode } from './agent';
import type { MemorialBrief } from './memorial';

// =========================================================================
// 部门契约 — 字段表来源: api-contracts.md §GET /api/chaotang/dept/{code}/overview
// =========================================================================

/** 部门状态(复用后端 aggregate_ministers 输出) */
export type DeptStatus = 'idle' | 'processing' | 'risk' | 'pending_review' | 'done';

export const DEPT_STATUS_LABEL: Record<DeptStatus, string> = {
  idle: '待命',
  processing: '处理中',
  risk: '风险',
  pending_review: '待审',
  done: '已完成',
};

export const DEPT_STATUS_COLOR: Record<DeptStatus, string> = {
  idle: '#6A7299',
  processing: '#6BA0FF',
  risk: '#F43F5E',
  pending_review: '#F0C66A',
  done: '#3DD68C',
};

type DepartmentIdentity = {
  agentCode: AgentCode;
  nameCn: string;
  nameEn: string;
  emoji: string;
  color: string;
  aliases: readonly string[];
  ministryId?: string;
  unifiedId?: string;
  v1Code?: string;
  promptCode?: string;
  privacySensitive?: boolean;
};

/** 前端部门身份总表。业务注册表只保留职责/展示字段，ID 与名称必须从这里派生。 */
export const DEPARTMENT_IDENTITIES = {
  finance: {
    agentCode: 'hu_bu', nameCn: '户部', nameEn: 'Revenue', emoji: '💰', color: '#F0C66A',
    aliases: ['finance', 'hubu', 'hubu_cfo', 'hu_bu'], ministryId: 'finance', unifiedId: 'finance', v1Code: 'hubu', promptCode: 'hu_bu',
  },
  personnel: {
    agentCode: 'li_bu', nameCn: '吏部', nameEn: 'Personnel', emoji: '👥', color: '#7B5EA7',
    aliases: ['personnel', 'hr', 'libu', 'li_bu', 'libu_hr_admin'], ministryId: 'personnel', unifiedId: 'personnel', v1Code: 'libu', promptCode: 'li_bu',
    privacySensitive: true,
  },
  market: {
    agentCode: 'li_bu_rites', nameCn: '礼部', nameEn: 'Rites', emoji: '🎨', color: '#C070D0',
    aliases: ['market', 'ritual', 'rites', 'libu_rites', 'li_bu_rites', 'li_bu_dept', 'rites_brand_comms'], ministryId: 'ritual', unifiedId: 'ritual', v1Code: 'libu_rites', promptCode: 'li_bu_dept',
  },
  ops: {
    agentCode: 'bing_bu', nameCn: '兵部', nameEn: 'Operations', emoji: '⚔️', color: '#6BA0FF',
    aliases: ['ops', 'war', 'bingbu', 'bing_bu', 'bingbu_sales'], ministryId: 'war', unifiedId: 'war', v1Code: 'bingbu', promptCode: 'bing_bu',
  },
  legal: {
    agentCode: 'xing_bu', nameCn: '刑部', nameEn: 'Justice', emoji: '⚖️', color: '#3DD68C',
    aliases: ['legal', 'justice', 'xingbu', 'xing_bu', 'xingbu_legal_risk'], ministryId: 'justice', unifiedId: 'justice', v1Code: 'xingbu', promptCode: 'xing_bu',
  },
  gongbu: {
    agentCode: 'gong_bu', nameCn: '工部', nameEn: 'Works', emoji: '🛠️', color: '#7FC9A8',
    aliases: ['gongbu', 'works', 'gong_bu', 'gongbu_delivery', 'product'], ministryId: 'works', unifiedId: 'works', v1Code: 'gongbu', promptCode: 'gong_bu',
  },
  guard: {
    agentCode: 'jin_yi_wei', nameCn: '锦衣卫', nameEn: 'Imperial Guard', emoji: '🛰', color: '#FB923C',
    aliases: ['guard', 'jinyiwei', 'jin_yi_wei', 'jinyiwei_intelligence'], unifiedId: 'jinyiwei', promptCode: 'jinyiwei',
  },
  physician: {
    agentCode: 'tai_yi_yuan', nameCn: '太医院', nameEn: 'Physician', emoji: '🩺', color: '#2DD4BF',
    aliases: ['physician', 'taiyi', 'tai_yi_yuan'], promptCode: 'taiyi',
  },
  observatory: {
    agentCode: 'qin_tian_jian', nameCn: '钦天监', nameEn: 'Observatory', emoji: '🔭', color: '#818CF8',
    aliases: ['observatory', 'astronomer', 'qintian', 'qintianjian', 'qin_tian_jian'], promptCode: 'qintian',
  },
  chancellor: {
    agentCode: 'prime_minister', nameCn: '丞相', nameEn: 'Prime Minister', emoji: '👑', color: '#F0C66A',
    aliases: ['chancellor', 'prime', 'prime_minister'],
  },
  historian: {
    agentCode: 'scribe', nameCn: '史官', nameEn: 'Scribe', emoji: '📜', color: '#A78BFA',
    aliases: ['historian', 'shiguan', 'scribe', '史馆'],
  },
} as const satisfies Record<string, DepartmentIdentity>;

export type CanonicalDepartmentCode = keyof typeof DEPARTMENT_IDENTITIES;

const ALIAS_TO_CANONICAL: Readonly<Record<string, CanonicalDepartmentCode>> = Object.fromEntries(
  Object.entries(DEPARTMENT_IDENTITIES).flatMap(([canonical, identity]) =>
    [...identity.aliases, identity.nameCn].map((alias) => [alias, canonical as CanonicalDepartmentCode]),
  ),
);

export const DEPARTMENT_NAME_BY_ALIAS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ALIAS_TO_CANONICAL).map(([alias, canonical]) => [alias, DEPARTMENT_IDENTITIES[canonical].nameCn]),
);

export function resolveCanonicalDepartment(code: string): CanonicalDepartmentCode | null {
  return ALIAS_TO_CANONICAL[code] ?? null;
}

export function resolveDepartmentAgentCode(code: string): AgentCode | null {
  const canonical = resolveCanonicalDepartment(code);
  if (canonical) return DEPARTMENT_IDENTITIES[canonical].agentCode;
  return code in AGENT_META ? (code as AgentCode) : null;
}

export function departmentNameCn(code: string): string {
  const canonical = resolveCanonicalDepartment(code);
  return canonical ? DEPARTMENT_IDENTITIES[canonical].nameCn : code;
}

export function isPrivacySensitiveDepartment(code: string): boolean {
  const canonical = resolveCanonicalDepartment(code);
  if (!canonical) return false;
  const identity = DEPARTMENT_IDENTITIES[canonical];
  return 'privacySensitive' in identity && identity.privacySensitive === true;
}

export function departmentIdentity(code: CanonicalDepartmentCode): DepartmentIdentity {
  return DEPARTMENT_IDENTITIES[code];
}

/** 六张既有 overview 卡的代号；保持原 API/页面契约，不等同于传统六部。 */
export const DEPT_CODES = ['finance', 'legal', 'market', 'guard', 'ops', 'physician'] as const;
export type DeptCode = (typeof DEPT_CODES)[number];

/** 传统六部、统一引擎和 v1 URL 的方言顺序都在 SSOT 内显式声明。 */
export const SIX_MINISTRY_CANONICAL_CODES = ['personnel', 'finance', 'market', 'ops', 'legal', 'gongbu'] as const;
export const MINISTRY_IDS = ['personnel', 'finance', 'ritual', 'war', 'justice', 'works'] as const;
export type MinistryId = (typeof MINISTRY_IDS)[number];
export const UNIFIED_DEPARTMENT_IDS = ['guard', 'finance', 'ops', 'personnel', 'legal', 'market', 'gongbu'] as const;
export type UnifiedDepartmentCanonicalCode = (typeof UNIFIED_DEPARTMENT_IDS)[number];
export type UnifiedDepartmentId = NonNullable<(typeof DEPARTMENT_IDENTITIES)[UnifiedDepartmentCanonicalCode]['unifiedId']>;
export const V1_LIUBU_CANONICAL_CODES = ['finance', 'personnel', 'market', 'ops', 'legal', 'gongbu'] as const;
export type V1CanonicalDepartmentCode = (typeof V1_LIUBU_CANONICAL_CODES)[number];
export type V1LiubuCode = NonNullable<(typeof DEPARTMENT_IDENTITIES)[V1CanonicalDepartmentCode]['v1Code']>;
export const PROMPT_DEPARTMENT_CANONICAL_CODES = [
  'finance', 'personnel', 'ops', 'legal', 'gongbu', 'market', 'guard', 'observatory', 'physician',
] as const;
export type PromptDepartmentCode =
  NonNullable<(typeof DEPARTMENT_IDENTITIES)[(typeof PROMPT_DEPARTMENT_CANONICAL_CODES)[number]]['promptCode']>;
export const STAMP_DEPARTMENT_CODES = ['libu', 'jinyiwei', 'hubu', 'xingbu', 'bingbu', 'gongbu', 'qintian', 'prime'] as const;
export type StampDepartmentCode = (typeof STAMP_DEPARTMENT_CODES)[number];
export const V1_DEPARTMENT_ALIASES: Readonly<Record<string, V1CanonicalDepartmentCode>> = {
  hubu: 'finance', finance: 'finance',
  libu: 'personnel', personnel: 'personnel',
  libu_rites: 'market', rites: 'market', market: 'market',
  bingbu: 'ops', ops: 'ops',
  xingbu: 'legal', legal: 'legal',
  gongbu: 'gongbu', works: 'gongbu',
};
export const PRIME_MINISTER_DEPARTMENT_CANONICAL_CODES = [
  'finance', 'gongbu', 'market', 'observatory', 'guard', 'personnel', 'ops', 'legal',
] as const;
export type PrimeMinisterDepartmentCode =
  (typeof DEPARTMENT_IDENTITIES)[(typeof PRIME_MINISTER_DEPARTMENT_CANONICAL_CODES)[number]]['agentCode'];
export const PRIME_MINISTER_DEPARTMENT_CODES: readonly PrimeMinisterDepartmentCode[] =
  PRIME_MINISTER_DEPARTMENT_CANONICAL_CODES.map((code) => DEPARTMENT_IDENTITIES[code].agentCode);
export const UNIFIED_DEPARTMENT_ID_VALUES: readonly UnifiedDepartmentId[] =
  UNIFIED_DEPARTMENT_IDS.map((code) => DEPARTMENT_IDENTITIES[code].unifiedId);
export const MINISTRY_TO_AGENT_CODE: Readonly<Record<MinistryId, AgentCode>> = Object.fromEntries(
  MINISTRY_IDS.map((id) => [id, DEPARTMENT_IDENTITIES[canonicalForMinistryId(id)].agentCode]),
) as Record<MinistryId, AgentCode>;

export function canonicalForMinistryId(id: MinistryId): CanonicalDepartmentCode {
  const found = SIX_MINISTRY_CANONICAL_CODES.find((code) => DEPARTMENT_IDENTITIES[code].ministryId === id);
  if (!found) throw new Error(`Unknown ministry id: ${id}`);
  return found;
}

export function canonicalForUnifiedId(id: UnifiedDepartmentId): UnifiedDepartmentCanonicalCode {
  const found = UNIFIED_DEPARTMENT_IDS.find((code) => DEPARTMENT_IDENTITIES[code].unifiedId === id);
  if (!found) throw new Error(`Unknown unified department id: ${id}`);
  return found;
}

/**
 * dept code → AgentCode 映射 ——【部门命名单一真相源 SSOT · 铁律2】。
 * 全仓任何 dept→agent/中文名 映射必须 import 这里,禁各自维护平行副本
 * (advisor-signal/dept-identity/decision-ledger/intentDetector 现有副本待逐步收敛到本表)。
 * 漂移由 dept-ssot.nodetest.ts 回归断言看守(改副本前先改本表)。来源: api-contracts.md §共享枚举。
 */
export const DEPT_TO_AGENT_CODE: Record<DeptCode, AgentCode> = Object.fromEntries(
  DEPT_CODES.map((code) => [code, DEPARTMENT_IDENTITIES[code].agentCode]),
) as Record<DeptCode, AgentCode>;

/** 部门显示名(前端用) */
export const DEPT_DISPLAY: Record<DeptCode, { nameCn: string; nameEn: string; emoji: string; color: string }> = Object.fromEntries(
  DEPT_CODES.map((code) => {
    const { nameCn, nameEn, emoji, color } = DEPARTMENT_IDENTITIES[code];
    return [code, { nameCn, nameEn, emoji, color }];
  }),
) as Record<DeptCode, { nameCn: string; nameEn: string; emoji: string; color: string }>;

/** 任务简报 */
export interface TaskBrief {
  taskId: string;
  title: string;
  progressPct: number;
}

/** 关键指标(可包含 mock 演示数据) */
export interface Metric {
  label: string;
  value: string;
  unit?: string;
}

/** 风险条目 */
export interface RiskItem {
  label: string;
  level: 'low' | 'medium' | 'high' | 'critical';
}

export const RISK_LEVEL_COLOR: Record<RiskItem['level'], string> = {
  low: '#3DD68C',
  medium: '#F0C66A',
  high: '#FB923C',
  critical: '#F43F5E',
};

/** 大臣元数据 */
export interface MinisterInfo {
  id: string;
  name: string;
  role: string;
  iconKey: string;
  description: string;
}

/** 部门详情聚合 */
export interface DeptOverview {
  code: string;
  agentCode: AgentCode;
  minister: MinisterInfo;
  status: DeptStatus;
  recentMemorials: MemorialBrief[];
  activeTasks: TaskBrief[];
  keyMetrics: Metric[];   // 部门特定,可含 [MOCK] 演示数据
  risks?: RiskItem[];
}
