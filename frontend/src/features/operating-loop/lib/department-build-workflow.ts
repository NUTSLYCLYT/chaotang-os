export type DepartmentBuildStatus =
  | 'idea'
  | 'prd'
  | 'design_review'
  | 'tech_plan'
  | 'assigned'
  | 'building'
  | 'integrating'
  | 'qa'
  | 'accepted'
  | 'archived'
  | 'blocked'
  | 'rework'
  | 'cancelled';

export type DepartmentBuildTarget =
  | 'gongbu'
  | 'hubu'
  | 'bingbu'
  | 'jinyiwei'
  | 'shiguan'
  | 'libu'
  | 'taiyi'
  | 'command-center';

export type BuildOwnerModel = 'claude' | 'codex' | 'secondary' | 'human';
export type BuildPriority = 'P0' | 'P1' | 'P2';
export type BuildRiskLevel = 'low' | 'medium' | 'high';

export interface BuildAssignee {
  role: string;
  ownerModel: BuildOwnerModel;
  responsibility: string;
}

export interface DepartmentBuildTask {
  id: string;
  title: string;
  targetDept: DepartmentBuildTarget;
  ownerDept: 'gongbu';
  status: DepartmentBuildStatus;
  priority: BuildPriority;
  businessGoal: string;
  userValue: string[];
  requiredPanels: string[];
  acceptanceCriteria: string[];
  assignees: BuildAssignee[];
  budgetLevel: 'low' | 'medium' | 'high';
  riskLevel: BuildRiskLevel;
  commandDraft: string;
  nextHref: string;
  budgetHref: string;
  archiveHref: string;
  delivery?: {
    files: string[];
    commands: string[];
    rollback: string;
    archiveTarget: string;
    releaseScript?: {
      title: string;
      objectIdSeed: string;
      route: string[];
      evidencePackage: string[];
      gateCommand: string;
    };
  };
}

export interface WorkflowStep {
  status: DepartmentBuildStatus;
  label: string;
  input: string;
  output: string;
  acceptance: string;
}

export const DEPARTMENT_BUILD_WORKFLOW: WorkflowStep[] = [
  {
    status: 'idea',
    label: '想法',
    input: '一句话需求',
    output: '问题定义',
    acceptance: '值不值得做说清楚',
  },
  {
    status: 'prd',
    label: 'PRD',
    input: '问题定义',
    output: '用户、场景、价值、边界',
    acceptance: '用户路径和不做什么都明确',
  },
  {
    status: 'design_review',
    label: '设计评审',
    input: 'PRD',
    output: '页面结构和核心路径',
    acceptance: '核心路径能走通',
  },
  {
    status: 'tech_plan',
    label: '技术方案',
    input: '页面结构',
    output: '文件边界、API、状态机',
    acceptance: '能分配给窗口执行',
  },
  {
    status: 'assigned',
    label: '已分配',
    input: '技术方案',
    output: '任务卡和窗口边界',
    acceptance: '每个窗口知道改哪里',
  },
  {
    status: 'building',
    label: '开发中',
    input: '任务卡',
    output: '代码和文档 diff',
    acceptance: '实现不越界',
  },
  {
    status: 'integrating',
    label: '集成',
    input: '多窗口 diff',
    output: '可运行版本',
    acceptance: '类型和路由不冲突',
  },
  {
    status: 'qa',
    label: '验收',
    input: '可运行版本',
    output: '问题清单和修复',
    acceptance: 'build 通过，核心路径可演示',
  },
  {
    status: 'accepted',
    label: '已验收',
    input: 'QA 通过',
    output: '验收记录',
    acceptance: '用户可确认',
  },
  {
    status: 'archived',
    label: '已归档',
    input: '验收记录',
    output: '史馆复盘',
    acceptance: '下次能复用',
  },
];

export const CHAOTANG_DEV_WORKBENCH_TASK: DepartmentBuildTask = {
  id: 'build-chaotang-dev-workbench-mvp',
  title: '建设朝堂开发工作台 MVP',
  targetDept: 'gongbu',
  ownerDept: 'gongbu',
  status: 'building',
  priority: 'P0',
  businessGoal: '让朝堂从页面集合收敛为可直接开工的开发操作系统。',
  userValue: [
    '打开工部就知道今天该推进哪张开发任务卡',
    '每张任务卡有文件边界、验收命令、回滚和归档目标',
    '军机处、户部、工部、史馆围绕同一任务卡协同',
    '下一次开发能复用本轮验收与复盘',
  ],
  requiredPanels: ['今日开发任务卡', '文件边界', '验收命令', '回滚口径', '史馆归档入口'],
  acceptanceCriteria: [
    '/departments 首屏显示今日开发任务卡',
    '任务卡展示 goal、owner、files、acceptance、commands、rollback、archive',
    '验收区能区分已完成与待验收，不把进行中伪装成已完成',
    '发布前固定跑通同一 objectId 从上书房/工部到军机处再到史馆的证据包',
    '页面保留服务巡查与白名单工具动作',
    'pnpm exec tsc --noEmit 通过',
    'Playwright 能打开页面并看到任务卡、验收命令、史馆归档入口',
  ],
  assignees: [
    { role: '产品收口', ownerModel: 'claude', responsibility: '定义最小开发闭环和验收口径' },
    { role: '工程实现', ownerModel: 'codex', responsibility: '把任务卡、文件边界、验收命令接入工部开发台' },
    { role: '测试红队', ownerModel: 'secondary', responsibility: '补充页面走查和文案一致性 checklist' },
    { role: '最终裁断', ownerModel: 'human', responsibility: '确认朝堂是否可以开始承接真实开发任务' },
  ],
  budgetLevel: 'low',
  riskLevel: 'medium',
  commandDraft:
    '让工部建设朝堂开发工作台 MVP，把一句话目标变成任务卡、文件边界、验收命令、回滚口径和史馆归档。',
  nextHref:
    '/command-center?task=build-chaotang-dev-workbench-mvp&intent=%E5%BB%BA%E8%AE%BE%E6%9C%9D%E5%A0%82%E5%BC%80%E5%8F%91%E5%B7%A5%E4%BD%9C%E5%8F%B0%20MVP',
  budgetHref: '/departments',
  archiveHref: '/archive?case=build-chaotang-dev-workbench-mvp',
  delivery: {
    files: [
      'src/features/operating-loop/lib/department-build-workflow.ts',
      'src/app/(dashboard)/departments/page.tsx',
      'e2e/gongbu-rd-pipeline.spec.ts',
      'docs/CHAOTANG_2026_DEV_SYSTEM.md',
    ],
    commands: [
      'pnpm exec tsc --noEmit',
      'pnpm exec playwright test e2e/gongbu-rd-pipeline.spec.ts --project=chromium',
      'pnpm exec playwright test e2e/gongbu-rd-pipeline.spec.ts --grep "建设台账"',
      'npm run build',
    ],
    rollback: '只回退本任务触及文件；不动用户或其他窗口已有脏改。',
    archiveTarget: '史馆记录目标、diff、验证命令、失败原因、可复用任务卡模板。',
    releaseScript: {
      title: '真实经营任务演示脚本',
      objectIdSeed: 'build-chaotang-dev-workbench-mvp',
      route: ['上书房下旨', '工部生成任务卡', '军机处复核', '史馆归档', '上书房可召回'],
      evidencePackage: ['同一 objectId', '对象护照', '军机 auditTrail', '史馆建设台账'],
      gateCommand: 'pnpm exec playwright test e2e/gongbu-rd-pipeline.spec.ts --grep "建设台账"',
    },
  },
};

export const DEPARTMENT_BUILD_TASKS: DepartmentBuildTask[] = [
  CHAOTANG_DEV_WORKBENCH_TASK,
  {
    id: 'build-hubu-v1',
    title: '建设户部经营预算中台 v1',
    targetDept: 'hubu',
    ownerDept: 'gongbu',
    status: 'tech_plan',
    priority: 'P0',
    businessGoal: '让户部能为所有部门建设任务提供预算、ROI、现金流和风险判断。',
    userValue: [
      '决策者知道先投什么',
      '工部知道建设资源边界',
      '军机处能按预算和风险排优先级',
      '史馆能复盘投入产出',
    ],
    requiredPanels: ['建设预算总览', '待批建设项目', 'ROI 与风险矩阵', '现金流压力', '户部建议'],
    acceptanceCriteria: [
      '/departments 正常显示',
      '至少 3 个待批建设项目',
      '每个项目有预算、ROI、风险、建议动作',
      '至少一条项目能跳转军机处立项',
      'npm run build 通过',
    ],
    assignees: [
      { role: '产品设计', ownerModel: 'claude', responsibility: '户部预算与 ROI 信息架构' },
      { role: '工程实现', ownerModel: 'codex', responsibility: '户部面板和工部联动 mock' },
      { role: '预算材料', ownerModel: 'secondary', responsibility: '审批文案、风险解释、QA checklist' },
      { role: '最终裁断', ownerModel: 'human', responsibility: '确认优先级和预算口径' },
    ],
    budgetLevel: 'high',
    riskLevel: 'medium',
    commandDraft:
      '让军机处立项建设户部经营预算中台 v1，目标是为工部所有部门建设任务提供预算、ROI、现金流和风险判断。',
    nextHref:
      '/command-center?task=build-hubu-v1&intent=%E5%BB%BA%E8%AE%BE%E6%88%B7%E9%83%A8%E7%BB%8F%E8%90%A5%E9%A2%84%E7%AE%97%E4%B8%AD%E5%8F%B0%20v1',
    budgetHref: '/departments',
    archiveHref: '/archive?case=build-hubu-v1',
  },
  {
    id: 'build-jinyiwei-invest-intel',
    title: '建设锦衣卫投资情报暗线',
    targetDept: 'jinyiwei',
    ownerDept: 'gongbu',
    status: 'prd',
    priority: 'P1',
    businessGoal: '让锦衣卫收集外部公司、政策、舆情和市场信号，并把可投机会交给户部测算。',
    userValue: ['减少错过窗口期', '把情报转成投资案', '让户部看到证据链', '让史馆保留判断记录'],
    requiredPanels: ['情报雷达', '证据链', '交户部测算', '风险标记', '史馆草档'],
    acceptanceCriteria: [
      '/departments 能看到投资情报入口',
      '情报可以形成待测算项目',
      '能跳转户部或军机处',
      '有来源和风险说明',
    ],
    assignees: [
      { role: '产品设计', ownerModel: 'claude', responsibility: '情报到投资案的用户路径' },
      { role: '工程实现', ownerModel: 'codex', responsibility: '锦衣卫入口和户部联动接口' },
      { role: '材料整理', ownerModel: 'secondary', responsibility: '情报 mock 和风险文案' },
    ],
    budgetLevel: 'medium',
    riskLevel: 'high',
    commandDraft:
      '让军机处立项建设锦衣卫投资情报暗线，打通情报登记、证据链、户部测算和史馆归档。',
    nextHref:
      '/command-center?task=build-jinyiwei-invest-intel&intent=%E5%BB%BA%E8%AE%BE%E9%94%A6%E8%A1%A3%E5%8D%AB%E6%8A%95%E8%B5%84%E6%83%85%E6%8A%A5%E6%9A%97%E7%BA%BF',
    budgetHref: '/departments',
    archiveHref: '/archive?case=build-jinyiwei-invest-intel',
  },
  {
    id: 'build-shiguan-dev-archive',
    title: '建设史馆开发复盘档案',
    targetDept: 'shiguan',
    ownerDept: 'gongbu',
    status: 'idea',
    priority: 'P1',
    businessGoal: '把每次开发的目标、diff、构建、QA、截图和复盘沉淀成可检索档案。',
    userValue: ['减少重复踩坑', '新任务可复用模板', '老板能看清投入产出', '次日建议有历史依据'],
    requiredPanels: ['开发档案', 'QA 证据', '复盘评分', '下次建议', '模板复用'],
    acceptanceCriteria: [
      '能看到开发复盘列表',
      '每条记录包含目标、结果、证据、风险',
      '能从工部跳转史馆归档',
      '支持复用为新任务模板',
    ],
    assignees: [
      { role: '复盘设计', ownerModel: 'claude', responsibility: '复盘字段和评分规则' },
      { role: '工程实现', ownerModel: 'codex', responsibility: '史馆档案入口与 mock store' },
      { role: '日报整理', ownerModel: 'secondary', responsibility: '每日归档文案和 checklist' },
    ],
    budgetLevel: 'low',
    riskLevel: 'low',
    commandDraft:
      '让军机处立项建设史馆开发复盘档案，记录每次开发的目标、结果、证据、风险和下次建议。',
    nextHref:
      '/command-center?task=build-shiguan-dev-archive&intent=%E5%BB%BA%E8%AE%BE%E5%8F%B2%E9%A6%86%E5%BC%80%E5%8F%91%E5%A4%8D%E7%9B%98%E6%A1%A3%E6%A1%88',
    budgetHref: '/departments',
    archiveHref: '/archive?case=build-shiguan-dev-archive',
  },
];

export const OWNER_MODEL_LABEL: Record<BuildOwnerModel, string> = {
  claude: 'Claude',
  codex: 'Codex',
  secondary: '次级模型',
  human: '人工',
};

export const BUILD_STATUS_LABEL: Record<DepartmentBuildStatus, string> = {
  idea: '想法',
  prd: 'PRD',
  design_review: '设计评审',
  tech_plan: '技术方案',
  assigned: '已分配',
  building: '开发中',
  integrating: '集成中',
  qa: '验收中',
  accepted: '已验收',
  archived: '已归档',
  blocked: '阻塞',
  rework: '返工',
  cancelled: '取消',
};
