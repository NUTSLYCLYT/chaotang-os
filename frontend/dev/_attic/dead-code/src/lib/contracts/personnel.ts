/**
 * 吏部 · 类型契约
 *
 * 组织人才与权限治理部门的实体类型定义。
 * 第一阶段用种子数据，后续接入 Turso。
 */

/* ── 岗位实体 ── */

export type PersonnelPositionStatus =
  | 'healthy'
  | 'overload'
  | 'vacant'
  | 'single_point';

export const PERSONNEL_POSITION_STATUS_LABEL: Record<PersonnelPositionStatus, string> = {
  healthy: '健康',
  overload: '超载',
  vacant: '空缺',
  single_point: '单点依赖',
};

export interface PersonnelCandidate {
  name: string;
  match: number; // 0-100 匹配度
  note: string;
}

export interface PersonnelPosition {
  id: string;
  title: string;
  team: string;
  status: PersonnelPositionStatus;
  headcount: number;
  filled: number;
  tone: 'green' | 'amber' | 'red';
  detail: string;
  candidates: PersonnelCandidate[];
}

/* ── 组织健康总览 ── */

export interface PersonnelOrgHealth {
  totalHeadcount: number;
  corePositions: number;
  coreFilledRate: number; // 0-100
  totalVacant: number;
  singlePointRisks: number;
  talentQuality: string;
  recommendation: string;
  generatedAt: string;
  source: 'seed' | 'turso' | 'fallback';
}

/* ── 汇总 ── */

export interface PersonnelOverview {
  orgHealth: PersonnelOrgHealth;
  positions: PersonnelPosition[];
}

/* ═══════════ 种子数据 ═══════════ */

export const SEED_POSITIONS: PersonnelPosition[] = [
  {
    id: 'pos-tech-lead',
    title: '技术负责人',
    team: '中央技术',
    status: 'healthy',
    headcount: 1,
    filled: 1,
    tone: 'green',
    detail: '架构、交付、跨部协作。当前负责人李某，交付经验强。',
    candidates: [
      { name: '李某', match: 91, note: '架构与交付经验强，报价 MVP 主力。' },
    ],
  },
  {
    id: 'pos-growth-lead',
    title: '增长负责人',
    team: '增长组',
    status: 'overload',
    headcount: 1,
    filled: 1,
    tone: 'amber',
    detail: '渠道、转化、客户分层。当前负责人超载 140%，需拆岗或补副手。',
    candidates: [
      { name: '王某', match: 78, note: '渠道经验匹配，缺少客户分层经验。' },
      { name: '张某', match: 65, note: '客户转化背景，无海外增长经验。' },
    ],
  },
  {
    id: 'pos-compliance-lead',
    title: '合规负责人',
    team: '合规审计组',
    status: 'healthy',
    headcount: 1,
    filled: 1,
    tone: 'green',
    detail: '权限、审计、合同风险。已有2位备选。',
    candidates: [
      { name: '赵某', match: 88, note: '法务背景，权限审计经验丰富。' },
    ],
  },
  {
    id: 'pos-east-tech',
    title: '华东技术团队负责人',
    team: '华东分部',
    status: 'overload',
    headcount: 8,
    filled: 7,
    tone: 'amber',
    detail: '华东区域项目护航，团队负载 118%，1 岗空缺 45+ 天。',
    candidates: [
      { name: '周某', match: 82, note: '华东本地，技术交付 5 年。' },
    ],
  },
  {
    id: 'pos-quote-engine',
    title: '报价引擎负责人',
    team: '中央技术',
    status: 'single_point',
    headcount: 1,
    filled: 1,
    tone: 'red',
    detail: '报价引擎核心逻辑仅 1 人熟悉，无继任计划。高危单点。',
    candidates: [],
  },
  {
    id: 'pos-security-audit',
    title: '安全审计官',
    team: '合规审计组',
    status: 'vacant',
    headcount: 1,
    filled: 0,
    tone: 'red',
    detail: '敏感权限审计岗空缺 60+ 天，当前由合规负责人兼任。',
    candidates: [
      { name: '钱某', match: 72, note: '安全背景，但无审计经验。' },
    ],
  },
  {
    id: 'pos-overseas-growth',
    title: '海外增长负责人',
    team: '增长组',
    status: 'vacant',
    headcount: 1,
    filled: 0,
    tone: 'amber',
    detail: '负责海外渠道与客户增长，候选人语言与渠道经验不足。',
    candidates: [
      { name: '孙某', match: 60, note: '英语流利，缺 B2B 增长经验。' },
    ],
  },
];

export const SEED_ORG_HEALTH: PersonnelOrgHealth = {
  totalHeadcount: 2480,
  corePositions: 186,
  coreFilledRate: 98,
  totalVacant: 16,
  singlePointRisks: 3,
  talentQuality: 'A-',
  recommendation:
    '报价引擎单点依赖和华东技术超载是当前两大组织风险。建议立即启动词人匹配流程，为报价引擎补副手、为华东补空缺岗。安全审计官空缺 60 天已是合规红线。',
  generatedAt: new Date().toISOString(),
  source: 'seed',
};

export const PERSONNEL_OVERVIEW: PersonnelOverview = {
  orgHealth: SEED_ORG_HEALTH,
  positions: SEED_POSITIONS,
};
