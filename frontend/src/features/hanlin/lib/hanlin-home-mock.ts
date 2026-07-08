import type {
  AiReview,
  Award,
  Contribution,
  Experiment,
  ExportOffering,
  ProductizedModule,
  Recommendation,
  RewardPeriod,
  ScoutedProject,
  UpgradeCandidate,
} from '@/features/hanlin/types';

export const HANLIN_OVERVIEW_STATS = {
  currentAwardCycle: '谷雨榜',
  submittedContributions: 28,
  rankedContributions: 9,
  activeCandidates: 12,
  incubatingModules: 4,
  exportableModules: 3,
};

export const REWARD_PERIODS_MOCK: RewardPeriod[] = [
  {
    id: 'period-guyu-2026',
    name: '谷雨榜',
    status: 'reviewing',
    revenueAmount: 320000,
    rewardPoolAmount: 3200,
    guaranteeAmount: 5000,
    awardedAmount: 4500,
    currency: 'CNY',
    startAt: '2026-04-01T00:00:00+08:00',
    endAt: '2026-04-30T23:59:59+08:00',
  },
];

export const CONTRIBUTIONS_MOCK: Contribution[] = [
  {
    id: 'contrib-command-receipt',
    title: '军机处御批回执强化组件',
    type: 'workflow',
    summary: '把发令后的主案切换、阶段焦点和回执表达做成稳定工作区组件。',
    authorName: '顾问司·沈砚',
    sourceUrl: '/command-center',
    status: 'awarded',
    originalityClaim: 'original',
    applicationHint: '军机处主工作台',
    createdAt: '2026-04-18T09:30:00+08:00',
  },
  {
    id: 'contrib-legal-brief',
    title: '法律初诊三层摘要模板',
    type: 'template',
    summary: '把 simple / pro / legal 三层输出收束为统一礼部表达。',
    authorName: '刑部·顾怀瑾',
    status: 'recommended',
    originalityClaim: 'improved',
    applicationHint: 'Legal Agent 出口层',
    createdAt: '2026-04-19T10:15:00+08:00',
  },
  {
    id: 'contrib-brain-sync',
    title: 'Obsidian 增量入馆工作流',
    type: 'integration',
    summary: '把知识同步从手工变成可追踪的 ingest 流程。',
    authorName: '工部·陆青岚',
    status: 'experimenting',
    originalityClaim: 'mixed',
    applicationHint: 'Super Brain 知识同步',
    createdAt: '2026-04-19T13:40:00+08:00',
  },
];

export const AWARDS_MOCK: Award[] = [
  {
    id: 'award-001',
    periodId: 'period-guyu-2026',
    contributionId: 'contrib-command-receipt',
    awardType: 'zhuangyuan',
    finalAmount: 3000,
    awardReason: '已进入主链工作台并显著增强发令后的执行可见性。',
    approvalStatus: 'approved',
    paidStatus: 'queued',
    createdAt: '2026-04-19T18:00:00+08:00',
  },
  {
    id: 'award-002',
    periodId: 'period-guyu-2026',
    contributionId: 'contrib-legal-brief',
    awardType: 'bangyan',
    finalAmount: 1500,
    awardReason: '提升法律产品的输出一致性，适合作为对外标准模板。',
    approvalStatus: 'approved',
    paidStatus: 'queued',
    createdAt: '2026-04-19T18:10:00+08:00',
  },
];

export const AI_REVIEWS_MOCK: AiReview[] = [
  {
    id: 'review-command-receipt',
    contributionId: 'contrib-command-receipt',
    originalityScore: 92,
    qualityScore: 90,
    valueScore: 94,
    riskScore: 18,
    confidenceScore: 89,
    awardBandSuggestion: '中状元候选',
    priceSuggestionMin: 2000,
    priceSuggestionMax: 3600,
    explanation: '已形成主链关键工作区能力，应用价值高，返工风险低。',
  },
  {
    id: 'review-legal-brief',
    contributionId: 'contrib-legal-brief',
    originalityScore: 78,
    qualityScore: 86,
    valueScore: 82,
    riskScore: 24,
    confidenceScore: 81,
    awardBandSuggestion: '榜眼候选',
    priceSuggestionMin: 1000,
    priceSuggestionMax: 2200,
    explanation: '适合礼部标准化输出，能显著提升法律产品的一致性。',
  },
  {
    id: 'review-brain-sync',
    contributionId: 'contrib-brain-sync',
    originalityScore: 71,
    qualityScore: 80,
    valueScore: 84,
    riskScore: 29,
    confidenceScore: 77,
    awardBandSuggestion: '应用之星候选',
    priceSuggestionMin: 800,
    priceSuggestionMax: 1800,
    explanation: '对工部知识中台的效率提升潜力大，但仍需应用验证。',
  },
];

export const RECOMMENDATIONS_MOCK: Recommendation[] = [
  {
    id: 'rec-001',
    contributionId: 'contrib-legal-brief',
    reviewerName: '翰林学士·纪晓岚',
    action: 'recommend_experiment',
    reason: '建议先接入御书房与法律初诊输出，验证跨产品的一致性。',
    targetModule: '御书房 / 法律初诊出口层',
    createdAt: '2026-04-19T14:20:00+08:00',
  },
  {
    id: 'rec-002',
    contributionId: 'contrib-brain-sync',
    reviewerName: '工部侍郎·顾闻川',
    action: 'recommend_experiment',
    reason: '与 Super Brain 的 ingest 主链直接相关，值得进入实验池。',
    targetModule: 'Super Brain ingest pipeline',
    createdAt: '2026-04-19T15:05:00+08:00',
  },
];

export const EXPERIMENTS_MOCK: Experiment[] = [
  {
    id: 'exp-001',
    contributionId: 'contrib-brain-sync',
    scenario: '工部知识同步增量试用',
    status: 'running',
    feedbackSummary: '已在 2 个知识源上测试，增量同步延迟下降明显，但回放日志仍需补全。',
  },
  {
    id: 'exp-002',
    contributionId: 'contrib-command-receipt',
    scenario: '军机处主案回执正式应用',
    status: 'adopted',
    feedbackSummary: '已经进入主系统关键工作台，明显提升了发令后的聚焦反馈。',
  },
];

export const SCOUTED_PROJECTS_MOCK: ScoutedProject[] = [
  {
    id: 'project-openhands',
    source: 'github',
    name: 'OpenHands',
    url: 'https://github.com/All-Hands-AI/OpenHands',
    summary: '通用软件工程 agent 框架，适合作为任务执行与工具使用参考系。',
    tags: ['agent', 'execution', 'tool-use'],
    repoStars: 54000,
    lastActiveAt: '2026-04-18',
  },
  {
    id: 'project-langgraph',
    source: 'github',
    name: 'LangGraph',
    url: 'https://github.com/langchain-ai/langgraph',
    summary: '适合多节点状态图与长流程编排的 agent 工作流框架。',
    tags: ['workflow', 'graph', 'state'],
    repoStars: 15000,
    lastActiveAt: '2026-04-19',
  },
  {
    id: 'project-mem0',
    source: 'github',
    name: 'Mem0',
    url: 'https://github.com/mem0ai/mem0',
    summary: '长记忆与用户画像层，可供 Super Brain 与 Hermes 观察借鉴。',
    tags: ['memory', 'retrieval'],
    repoStars: 31000,
    lastActiveAt: '2026-04-18',
  },
];

export const UPGRADE_CANDIDATES_MOCK: UpgradeCandidate[] = [
  {
    id: 'candidate-openhands',
    projectId: 'project-openhands',
    status: 'evaluated',
    maturityScore: 87,
    compatibilityScore: 72,
    integrationCostScore: 58,
    strategicValueScore: 84,
    commercialValueScore: 76,
    recommendedPriority: 'P1',
    notes: '适合作为兵部 / 工部执行框架参考，不适合直接替代主系统表达层。',
  },
  {
    id: 'candidate-langgraph',
    projectId: 'project-langgraph',
    status: 'trialing',
    maturityScore: 82,
    compatibilityScore: 79,
    integrationCostScore: 63,
    strategicValueScore: 88,
    commercialValueScore: 73,
    recommendedPriority: 'P1',
    notes: '可用于纪晓岚线的升级候选图与贡献金库应用池状态机设计。',
  },
  {
    id: 'candidate-mem0',
    projectId: 'project-mem0',
    status: 'scouted',
    maturityScore: 76,
    compatibilityScore: 69,
    integrationCostScore: 61,
    strategicValueScore: 81,
    commercialValueScore: 71,
    recommendedPriority: 'P2',
    notes: '适合作为记忆层能力观察，不宜未经评估直接进入主系统。',
  },
];

export const PRODUCTIZED_MODULES_MOCK: ProductizedModule[] = [
  {
    id: 'module-legal-brief-pack',
    name: '法律初诊摘要模板包',
    originType: 'contribution',
    originRef: 'contrib-legal-brief',
    status: 'standardizing',
    docStatus: 'draft',
    apiStatus: 'n/a',
    dependencyStatus: 'stable',
    boundaryStatus: 'reviewing',
    ownerName: '礼部 / 刑部联合',
    notes: '先整理 simple / pro / legal 三层模板，再考虑对外服务包。',
  },
  {
    id: 'module-brain-sync-flow',
    name: '知识同步增量工作流',
    originType: 'contribution',
    originRef: 'contrib-brain-sync',
    status: 'packaged',
    docStatus: 'ready',
    apiStatus: 'draft',
    dependencyStatus: 'needs_cleanup',
    boundaryStatus: 'reviewing',
    ownerName: '工部',
    notes: '适合作为企业知识同步方案的标准件，但仍需清理依赖边界。',
  },
  {
    id: 'module-command-receipt-kit',
    name: '军机处御批回执组件集',
    originType: 'internal',
    originRef: 'contrib-command-receipt',
    status: 'sellable',
    docStatus: 'ready',
    apiStatus: 'n/a',
    dependencyStatus: 'stable',
    boundaryStatus: 'clear',
    ownerName: '中书门下 / 工部',
    notes: '适合沉淀为交付包或设计实现资产。',
  },
];

export const EXPORT_OFFERINGS_MOCK: ExportOffering[] = [
  {
    id: 'offering-legal-brief-pack',
    productizedModuleId: 'module-legal-brief-pack',
    offeringType: 'service_package',
    displayName: '法律初诊模板服务包',
    summary: '将法律初诊输出结构化模板化，适合企业法务与老板快速判断场景。',
    pricingMode: 'custom_quote',
    priceFloor: 5000,
    priceCeiling: 30000,
    salesStatus: 'internal_only',
    marketNotes: '适合先跟 Legal Agent 套装一起卖。',
  },
  {
    id: 'offering-brain-sync-api',
    productizedModuleId: 'module-brain-sync-flow',
    offeringType: 'workflow_pack',
    displayName: '知识同步工作流包',
    summary: '把知识源增量同步和入馆流程打包成可复用工作流。',
    pricingMode: 'subscription',
    priceFloor: 299,
    priceCeiling: 1999,
    salesStatus: 'draft',
    marketNotes: '后续可与 Super Brain 企业版捆绑。',
  },
  {
    id: 'offering-command-receipt-kit',
    productizedModuleId: 'module-command-receipt-kit',
    offeringType: 'plugin',
    displayName: '御批回执交付组件',
    summary: '把主案回执、阶段焦点和发令反馈打包成高感知交付组件。',
    pricingMode: 'one_time',
    priceFloor: 1999,
    priceCeiling: 9999,
    salesStatus: 'sellable',
    marketNotes: '适合高客单交付项目和 UI / workflow 资产包。',
  },
];

export function getContributionById(id: string) {
  return CONTRIBUTIONS_MOCK.find((item) => item.id === id) ?? null;
}

export function getAiReviewByContributionId(contributionId: string) {
  return AI_REVIEWS_MOCK.find((item) => item.contributionId === contributionId) ?? null;
}

export function getRecommendationsByContributionId(contributionId: string) {
  return RECOMMENDATIONS_MOCK.filter((item) => item.contributionId === contributionId);
}

export function getExperimentsByContributionId(contributionId: string) {
  return EXPERIMENTS_MOCK.filter((item) => item.contributionId === contributionId);
}

export function getUpgradeCandidateById(id: string) {
  return UPGRADE_CANDIDATES_MOCK.find((item) => item.id === id) ?? null;
}

export function getProjectById(id: string) {
  return SCOUTED_PROJECTS_MOCK.find((item) => item.id === id) ?? null;
}
