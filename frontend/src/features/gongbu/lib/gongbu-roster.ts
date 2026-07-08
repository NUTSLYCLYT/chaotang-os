/**
 * 工部 · 班底配置（一引擎多班底 · 可定制 · 2026-06-27）
 *
 * 与户部同构：一台引擎(分类→会诊→圣裁→缺证/产线锁/跨部会审→交付奏折)复用；班底=岗位+深度。
 * 工部 = 产品技术 + 硬件(PACK)交付。岗位映射后端 8 司(GongbuSubOfficeId)。
 *
 * 纪律：
 *   - 铁律2(SSOT)：backendQuestionTypes 引 GongbuDeliveryQuestionType 真枚举。
 *   - 铁律9：工部触真实产线资产(成本/BOM/交期/报价/供应商) → 前端整字段上锁、转后端 jiqun。
 *   - guardianSkill 指向已装大神 skill(开发态会审镜片，AGENTS.md §12.1)。
 */
import type { GongbuDeliveryQuestionType } from '@/core/courtos/gongbu/gongbu-types';

export type GongbuRosterId = 'lite' | 'pro' | 'custom';

export interface GongbuStaffRole {
  id: string;
  nameCn: string;
  realJobTitle: string;
  duties: string;
  frontendTopics: string[];
  backendQuestionTypes: GongbuDeliveryQuestionType[];
  guardianSkill: string;
  guardianLens: string;
  accent: string;
  custom?: boolean;
  note?: string;
}

export interface GongbuRoster {
  id: GongbuRosterId;
  label: string;
  revenueBand: string;
  staff: GongbuStaffRole[];
}

const TEAL = '#7FC9A8';
const BLUE = '#4A82F0';

const BASE_STAFF: Record<string, GongbuStaffRole> = {
  cto_cpo_chief: {
    id: 'cto_cpo_chief',
    nameCn: '总师',
    realJobTitle: 'CTO / CPO',
    duties: '总揽技术与产品、跨司合议、最终交付圣裁',
    frontendTopics: ['能不能造', '该不该建', '技术总裁决'],
    backendQuestionTypes: ['OTHER_DELIVERY_RISK'],
    guardianSkill: 'karpathy-perspective',
    guardianLens: '工部·Karpathy：先搭能端到端跑通的最小基线，再优化；没有 eval 就在感觉里空转。',
    accent: BLUE,
  },
  solution_architecture: {
    id: 'solution_architecture',
    nameCn: '架构',
    realJobTitle: '方案架构师',
    duties: '技术选型、架构设计、API 契约、技术可行性',
    frontendTopics: ['技术可行吗', 'MVP 怎么切', '架构合理吗', '技术选型'],
    backendQuestionTypes: ['TECHNICAL_FEASIBILITY', 'MVP_SCOPE'],
    guardianSkill: 'karpathy-perspective',
    guardianLens: 'Karpathy：又快又脏先跑通；马斯克：这步真需要吗，删到不能再删。',
    accent: BLUE,
  },
  quality_acceptance: {
    id: 'quality_acceptance',
    nameCn: '质量',
    realJobTitle: '质量 / 验收',
    duties: '验收标准、质量门、测试补证（tsc/build/截图）',
    frontendTopics: ['验收标准', '质量门过没过', '测试补证'],
    backendQuestionTypes: ['QUALITY_ACCEPTANCE', 'DELIVERY_REVIEW'],
    guardianSkill: 'taiichi-ohno-perspective',
    guardianLens: '少府·大野耐一：现场零缺陷，质量门不放行就停线，不带病交付。',
    accent: TEAL,
  },
  schedule_capacity: {
    id: 'schedule_capacity',
    nameCn: '工期',
    realJobTitle: '排期 / 产能',
    duties: '工期估算、产能评估、节拍与瓶颈（🔒交期属产线资产）',
    frontendTopics: ['大概多久', '产能够不够', '瓶颈在哪'],
    backendQuestionTypes: ['SCHEDULE_CAPACITY'],
    guardianSkill: 'taiichi-ohno-perspective',
    guardianLens: '大野耐一：识别瓶颈、消除浪费；真实交期是产线承诺 → 转后端，不在前端拍。',
    accent: TEAL,
    note: '🔒 真实交期=产线资产，前端只给定性「快/慢/有无瓶颈」，具体日期转后端核算。',
  },
  bom_supply_chain: {
    id: 'bom_supply_chain',
    nameCn: '供应链',
    realJobTitle: 'BOM / 供应链',
    duties: 'BOM、采购、供应商（🔒成本/报价/供应商=产线资产，整体上锁）',
    frontendTopics: ['物料能否搞定', '供应商有无替代', '采购风险'],
    backendQuestionTypes: ['BOM_SUPPLY_CHAIN', 'STORAGE_OR_HARDWARE_PROJECT'],
    guardianSkill: 'elon-musk-perspective',
    guardianLens: '将作大匠·马斯克：成本拆到料工费第一性、垂直整合；但真实 BOM/成本=产线资产，转后端。',
    accent: TEAL,
    note: '🔒 成本/报价/BOM/供应商=产线资产，前端不渲染其值，整字段上锁转后端(铁律9)。',
  },
  delivery_commitment_gate: {
    id: 'delivery_commitment_gate',
    nameCn: '承诺门',
    realJobTitle: '对外交付承诺把关',
    duties: '对外交付/交期/价格承诺的最后一道门（不可逆，须人工亲裁）',
    frontendTopics: ['能不能对外承诺', '范围变更影响', '违约风险'],
    backendQuestionTypes: ['DELIVERY_COMMITMENT', 'SCOPE_CHANGE'],
    guardianSkill: 'taleb-perspective',
    guardianLens: '太史令·塔勒布：对外承诺=尾部风险，skin in the game；轻诺即埋雷，宁慢勿赌。',
    accent: BLUE,
  },
};

const PRO_EXTRA_STAFF: Record<string, GongbuStaffRole> = {
  field_implementation: {
    id: 'field_implementation',
    nameCn: '现场',
    realJobTitle: '现场实施',
    duties: '现场部署、安装、调试、现地现物',
    frontendTopics: ['现场能否落地', '安装调试风险'],
    backendQuestionTypes: ['FIELD_IMPLEMENTATION'],
    guardianSkill: 'taiichi-ohno-perspective',
    guardianLens: '大野耐一：现地现物，去现场看真问题，不在会议室拍脑袋。',
    accent: TEAL,
  },
  delivery_operations: {
    id: 'delivery_operations',
    nameCn: '运维',
    realJobTitle: '交付运维',
    duties: '上线、监控、运维、交付后稳定性',
    frontendTopics: ['上线稳不稳', '运维负担', '可观测性'],
    backendQuestionTypes: ['OTHER_DELIVERY_RISK'],
    guardianSkill: 'karpathy-perspective',
    guardianLens: 'Karpathy：工程化与可观测，交付不是终点，稳定运行才是。',
    accent: BLUE,
  },
};

export const GONGBU_STAFF_CATALOG: Record<string, GongbuStaffRole> = { ...BASE_STAFF, ...PRO_EXTRA_STAFF };
export const GONGBU_STAFF_CATALOG_LIST: GongbuStaffRole[] = Object.values(GONGBU_STAFF_CATALOG);

export const LITE_PRESET_IDS = [
  'cto_cpo_chief',
  'solution_architecture',
  'quality_acceptance',
  'schedule_capacity',
  'bom_supply_chain',
  'delivery_commitment_gate',
] as const;

export const PRO_PRESET_IDS = ['field_implementation', 'delivery_operations', ...LITE_PRESET_IDS] as const;

function resolveRoster(meta: Omit<GongbuRoster, 'staff'>, ids: readonly string[]): GongbuRoster {
  const staff = ids.map((id) => GONGBU_STAFF_CATALOG[id]).filter((s): s is GongbuStaffRole => Boolean(s));
  return { ...meta, staff };
}

export const GONGBU_LITE_ROSTER: GongbuRoster = resolveRoster(
  { id: 'lite', label: '轻班底 · 小工部', revenueBand: '小团队 / 单产品线' },
  LITE_PRESET_IDS,
);

export const GONGBU_PRO_ROSTER: GongbuRoster = resolveRoster(
  { id: 'pro', label: '专业班底 · 完整交付流水线', revenueBand: '多产品线 / 硬件量产' },
  PRO_PRESET_IDS,
);

export const DEFAULT_GONGBU_ROSTER: GongbuRosterId = 'lite';

export function addStaffById(roster: GongbuRoster, staffId: string): GongbuRoster {
  if (roster.staff.some((s) => s.id === staffId)) return roster;
  const role = GONGBU_STAFF_CATALOG[staffId];
  if (!role) return roster;
  return { ...roster, id: 'custom', label: '自定义班底', staff: [...roster.staff, role] };
}

export function removeStaffById(roster: GongbuRoster, staffId: string): GongbuRoster {
  if (!roster.staff.some((s) => s.id === staffId)) return roster;
  return { ...roster, id: 'custom', label: '自定义班底', staff: roster.staff.filter((s) => s.id !== staffId) };
}

export function availableToAdd(roster: GongbuRoster): GongbuStaffRole[] {
  const have = new Set(roster.staff.map((s) => s.id));
  return GONGBU_STAFF_CATALOG_LIST.filter((s) => !have.has(s.id));
}
