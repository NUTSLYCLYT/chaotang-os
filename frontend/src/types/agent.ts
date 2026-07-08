/**
 * 朝堂 OS V2 · Agent 相关类型
 *
 * 11 个 agent 代号为冻结层 Tier 0，严禁随意增删
 */

/* ==========================================================================
   Agent 代号（冻结）
   ========================================================================== */

export type AgentCode =
  | 'prime_minister'    // 丞相 · 中枢编排
  | 'scribe'            // 史官 · 记忆审计
  | 'li_bu'             // 吏部 · 人力组织
  | 'hu_bu'             // 户部 · 金融投资
  | 'li_bu_rites'       // 礼部 · 品牌营销
  | 'bing_bu'           // 兵部 · 竞品战略
  | 'xing_bu'           // 刑部 · 制度风控
  | 'gong_bu'           // 工部 · 产品技术
  | 'qin_tian_jian'     // 钦天监 · 未来推演
  | 'jin_yi_wei'        // 锦衣卫 · 全球情报
  | 'tai_yi_yuan';      // 太医院 · 健康管理

/** Agent 分层 */
export type AgentTier = 'core' | 'ministry' | 'special_bureau';

/* ==========================================================================
   Agent 元数据
   ========================================================================== */

export interface AgentMeta {
  code: AgentCode;
  nameCn: string;
  nameEn: string;
  tier: AgentTier;
  description: string;
  emoji: string;
  /** 主色调（用于边框/图标/状态点） */
  color: string;
  /** 职责关键词 */
  responsibilities: string[];

  /* ========== 完整职责书 · 新增 ========== */

  /** 可交付能力清单（最高层抽象） */
  capabilities: string[];
  /** 底层技能代号（可被路由器调用） */
  skills: string[];
  /** 接受的输入类型 */
  inputTypes: string[];
  /** 产出的输出类型 */
  outputTypes: string[];
  /** 依赖的数据源（真实 / 外部） */
  dataSources: string[];
  /** 能力外的升级目标 */
  escalationTargets: AgentCode[];
  /** fallback 策略说明 */
  fallbackStrategy: string;
  /** 典型任务示例（3-5 个） */
  typicalTasks: string[];
  /** 基准置信度（Mock / 无真实数据时的默认值） */
  confidenceBaseline: number;
  /** 是否已接入真实数据源（P0 多为 false） */
  realDataConnected?: boolean;
}

/* ==========================================================================
   Agent 统一状态机
   ========================================================================== */

export type AgentState =
  | 'idle'
  | 'assigned'
  | 'running'
  | 'waiting_dependency'
  | 'summarizing'
  | 'completed'
  | 'failed'
  | 'fallback_completed'
  | 'archived';

/* ==========================================================================
   Agent 运行记录
   ========================================================================== */

export interface AgentRun {
  id: string;
  taskId: string;
  subtaskId: string;
  agentCode: AgentCode;
  assignedNodeId?: string;
  routingNodeIds?: string[];
  nodeType?: string;
  nodeMaturity?: string;
  state: AgentState;
  progressPct: number;
  currentTaskTitle?: string;
  latestSummary?: string;
  riskLevel?: RiskLevel;
  isWaitingDependency: boolean;
  hasReported: boolean;
  confidence?: number;
  startedAt?: string;
  completedAt?: string;
}

export const NODE_LABELS: Record<string, string> = {
  prime_minister: '丞相中枢',
  scribe: '史官',
  openclaw: 'OpenClaw',
  hermes: 'Hermes',
  human_throne_review: '王座终裁',
  waijiaobu_sales: '销售蜂群',
  waijiaobu_web_marketing: '网站营销蜂群',
  waijiaobu_short_video: '短视频营销蜂群',
  waijiaobu_brand: '品牌宣传蜂群',
  yuanyangbu_overseas_commerce: '海外电商蜂群',
  yuanyangbu_cross_border_ads: '跨境投放蜂群',
  yuanyangbu_overseas_site_ops: '海外站点运营蜂群',
  jinyiwei_signal: '信号侦缉蜂群',
  jinyiwei_policy_watch: '政策监看蜂群',
  qintianjian_forecast: '趋势预测蜂群',
  qintianjian_scenario: '情景推演蜂群',
};

export function getNodeDisplayName(nodeId: string): string {
  return NODE_LABELS[nodeId] ?? AGENT_META[nodeId as AgentCode]?.nameCn ?? nodeId;
}

/* ==========================================================================
   Agent 统一输入/输出协议（与后端对齐）
   ========================================================================== */

export type RequestedOutputType = 'brief' | 'report' | 'plan' | 'forecast';
export type AgentRunStatus = 'completed' | 'failed' | 'fallback_completed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AgentInput {
  taskId: string;
  subtaskId: string;
  agentId: AgentCode;
  goal: string;
  taskContext: Record<string, unknown>;
  dependencyInputs: Record<string, unknown>;
  attachments: Attachment[];
  constraints: string[];
  mode: 'scripted' | 'hybrid' | 'live';
  userPreferences: Record<string, unknown>;
  requestedOutputType: RequestedOutputType;
}

export interface AgentOutput {
  taskId: string;
  subtaskId: string;
  agentId: AgentCode;
  status: AgentRunStatus;
  summary: string;
  structuredOutput: Record<string, unknown>;
  riskFlags: RiskFlag[];
  assumptions: string[];
  confidence: number;
  needsFollowup: boolean;
  nextNeededInputs: string[];
  displayPayload: DisplayPayload;
}

export interface RiskFlag {
  level: RiskLevel;
  category: string;
  description: string;
  source?: string;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  size: number;
}

export type DisplayPayloadType =
  | 'text'
  | 'markdown'
  | 'chart'
  | 'map'
  | 'table'
  | 'kv_list'
  | 'metric_grid'
  | 'scenario'
  | 'mixed';

export interface DisplayPayload {
  type: DisplayPayloadType;
  content: unknown;
}

/* ==========================================================================
   Agent 注册表（constant —— 方便 overview/departments 页面迭代）
   ========================================================================== */

export const AGENT_META: Record<AgentCode, AgentMeta> = {
  /* ========== 核心中枢 ========== */
  prime_minister: {
    code: 'prime_minister',
    nameCn: '丞相',
    nameEn: 'Prime Minister',
    tier: 'core',
    description: '任务理解 · 拆解 · 调度 · 仲裁 · 汇总',
    emoji: '👑',
    color: '#D4A84B',
    responsibilities: ['意图识别', '子任务规划', '依赖图构建', '结果汇总', '冲突仲裁'],
    capabilities: [
      '任务理解与意图识别',
      '子任务拆解与依赖图构建',
      'Agent 调度与任务分派',
      '中间结果汇总与去冲突',
      '复议与升级决策',
      '最终呈报草稿撰写',
    ],
    skills: [
      'intent_recognition',
      'task_decomposition',
      'dependency_graph_building',
      'agent_routing',
      'result_aggregation',
      'conflict_resolution',
      'escalation_decision',
    ],
    inputTypes: ['user_command', 'user_clarification', 'agent_output', 'historical_context'],
    outputTypes: ['task_plan', 'subtask_assignment', 'aggregated_report', 'clarification_request'],
    dataSources: ['task_store', 'agent_registry', 'historical_memory', 'user_preferences'],
    escalationTargets: [],
    fallbackStrategy: '意图不清时触发 clarification_needed，等待陛下补充；编排失败降级为顺序执行。',
    typicalTasks: [
      '制定新品发布战略',
      '组织季度复盘',
      '跨部门协同决策',
      '战略方向研判',
    ],
    confidenceBaseline: 0.88,
    realDataConnected: true,
  },

  scribe: {
    code: 'scribe',
    nameCn: '史官',
    nameEn: 'Scribe',
    tier: 'core',
    description: '记忆 · 审计 · 复盘 · 召回',
    emoji: '📜',
    color: '#9AA3C4',
    responsibilities: ['历史归档', '批示记录', '相似召回', '成功模板沉淀', '偏好学习'],
    capabilities: [
      '全过程审计日志',
      '批示与复议记录',
      '相似案例召回',
      '成功路径抽取',
      '陛下偏好沉淀',
      '任务族谱构建',
    ],
    skills: [
      'event_archival',
      'similarity_search',
      'pattern_extraction',
      'preference_learning',
      'timeline_reconstruction',
    ],
    inputTypes: ['full_task', 'review_action', 'recall_query', 'feedback'],
    outputTypes: ['memory_record', 'similar_matches', 'success_template', 'chronicle'],
    dataSources: ['memory_store', 'task_history', 'event_logs'],
    escalationTargets: ['prime_minister'],
    fallbackStrategy: '关键词召回失败 → 回退到时间倒序的最近 N 条记录。',
    typicalTasks: ['陛下偏好回顾', '相似案例检索', '年度复盘报告', '成功模板抽取'],
    confidenceBaseline: 0.8,
    realDataConnected: true,
  },

  /* ========== 六部 ========== */
  li_bu: {
    code: 'li_bu',
    nameCn: '吏部',
    nameEn: 'Personnel',
    tier: 'ministry',
    description: '组织 · 人力 · 招聘 · 绩效',
    emoji: '👥',
    color: '#6BA0FF',
    responsibilities: ['人力盘点', '岗位诊断', '绩效评估', '组织设计', '晋升决策'],
    capabilities: [
      '人力资源盘点',
      '关键岗位识别与继任规划',
      '绩效体系设计与评估',
      '组织架构诊断与调整',
      '招聘计划与人才画像',
      '培训体系设计',
    ],
    skills: ['hr_audit', 'kpi_review', 'org_design', 'talent_pipeline', 'succession_planning'],
    inputTypes: ['employee_data', 'kpi_reports', 'org_chart', 'hiring_requests'],
    outputTypes: ['hr_diagnostic', 'hiring_plan', 'performance_ranking', 'org_restructure_plan'],
    dataSources: ['HRIS 系统', '绩效考核系统', '组织架构图', 'LinkedIn / 招聘市场'],
    escalationTargets: ['prime_minister', 'xing_bu'],
    fallbackStrategy: '数据缺失 → 降级为模板问卷收集；绩效数据敏感 → 标记 PII 脱敏。',
    typicalTasks: [
      'Q4 全员绩效复盘',
      '关键岗位继任规划',
      '扁平化组织改造',
      '高管团队搭建',
    ],
    confidenceBaseline: 0.76,
    realDataConnected: false,
  },

  hu_bu: {
    code: 'hu_bu',
    nameCn: '户部',
    nameEn: 'Revenue',
    tier: 'ministry',
    description: '金融投资 · 股票分析 · 估值 · 资产配置',
    emoji: '💰',
    color: '#F0C66A',
    responsibilities: ['股票估值', '财报研判', '投资组合', '资产配置', '风险收益'],
    capabilities: [
      '个股估值（DCF / 相对估值）',
      '财报深度解读',
      '投资组合构建与再平衡',
      '风险收益分析',
      '行业景气度研判',
      '宏观流动性分析',
    ],
    skills: [
      'dcf_valuation',
      'fundamental_analysis',
      'portfolio_construction',
      'risk_parity',
      'macro_analysis',
      'sector_rotation',
    ],
    inputTypes: [
      'financial_statements',
      'market_data',
      'portfolio_holdings',
      'macro_indicators',
    ],
    outputTypes: [
      'buy_hold_sell_rating',
      'target_price',
      'valuation_report',
      'allocation_plan',
      'risk_report',
    ],
    dataSources: ['Wind', 'Bloomberg Terminal', '交易所公开数据', '上市公司年报', 'FRED 宏观库'],
    escalationTargets: ['bing_bu', 'qin_tian_jian'],
    fallbackStrategy: '数据源不可用 → 使用历史均值 + 同行业对标；不确定性高 → 给出区间而非点估计。',
    typicalTasks: [
      'NVIDIA 估值研判',
      'A 股季度策略',
      '核心资产配置建议',
      '宏观流动性研判',
    ],
    confidenceBaseline: 0.82,
    realDataConnected: true,
  },

  li_bu_rites: {
    code: 'li_bu_rites',
    nameCn: '礼部',
    nameEn: 'Rites',
    tier: 'ministry',
    description: '品牌 · 营销 · 高管摘要 · 对外表达',
    emoji: '🎨',
    color: '#C070D0',
    responsibilities: ['品牌诊断', '传播策略', '高管摘要', '内容策划', '海外电商'],
    capabilities: [
      '品牌健康度诊断',
      '全渠道传播策略',
      '短视频 / 直播运营',
      '高管摘要与对外沟通',
      '危机公关响应',
      '海外电商本地化',
    ],
    skills: [
      'brand_audit',
      'channel_mix_optimization',
      'content_planning',
      'executive_summary_writing',
      'crisis_pr',
      'overseas_ecommerce',
    ],
    inputTypes: ['brand_data', 'user_persona', 'campaign_history', 'media_mentions'],
    outputTypes: ['brand_report', 'campaign_plan', 'exec_digest', 'crisis_response_playbook'],
    dataSources: ['小红书 / 抖音 / 视频号 API', '品牌监测工具', '电商后台', '舆情平台'],
    escalationTargets: ['bing_bu', 'jin_yi_wei'],
    fallbackStrategy: '第三方数据不足 → 给出行业 benchmark 建议；危机公关 → 走保守响应模板。',
    typicalTasks: [
      '新品发布会策划',
      '小红书双渠道投放',
      'CEO 致股东信',
      '负面舆情响应',
    ],
    confidenceBaseline: 0.78,
    realDataConnected: true,
  },

  bing_bu: {
    code: 'bing_bu',
    nameCn: '兵部',
    nameEn: 'Military',
    tier: 'ministry',
    description: '竞品 · 战略 · 攻防 · 市场进入',
    emoji: '⚔️',
    color: '#F43F5E',
    responsibilities: ['竞品情报', '战略攻防', '市场份额', '定价策略', '并购分析'],
    capabilities: [
      '竞品全方位情报收集',
      'SWOT / 波特五力分析',
      '市场进入与退出决策',
      '定价战术与攻防',
      '份额争夺与壁垒构建',
      '并购标的评估',
    ],
    skills: [
      'competitor_intelligence',
      'swot_analysis',
      'market_entry_strategy',
      'pricing_strategy',
      'm_and_a_review',
    ],
    inputTypes: [
      'competitor_specs',
      'market_share_data',
      'industry_reports',
      'patent_data',
    ],
    outputTypes: [
      'competitive_landscape',
      'attack_plan',
      'defense_plan',
      'pricing_recommendation',
    ],
    dataSources: ['IDC / Gartner', '专利数据库', '竞品官网 / 年报', '行业协会报告'],
    escalationTargets: ['qin_tian_jian', 'jin_yi_wei'],
    fallbackStrategy: '情报不足 → 联动锦衣卫加急扫描；判断低置信度 → 给出 A/B 预案。',
    typicalTasks: [
      'Top 3 竞品月报',
      '新市场进入分析',
      '防御性定价策略',
      '并购标的评估',
    ],
    confidenceBaseline: 0.76,
    realDataConnected: false,
  },

  xing_bu: {
    code: 'xing_bu',
    nameCn: '刑部',
    nameEn: 'Justice',
    tier: 'ministry',
    description: '制度 · 行政 · 风控 · 合规 · 治理',
    emoji: '⚖️',
    color: '#3DD68C',
    responsibilities: ['合规审查', '制度设计', '风险管理', '治理诊断', 'KPI/OKR'],
    capabilities: [
      '法律法规合规审查',
      '公司制度起草与更新',
      '运营风险识别与控制',
      '内控审计',
      'KPI/OKR 体系设计',
      '治理结构诊断',
    ],
    skills: [
      'compliance_review',
      'policy_drafting',
      'risk_assessment',
      'internal_audit',
      'okr_framework',
      'governance_diagnostic',
    ],
    inputTypes: ['policy_docs', 'audit_reports', 'risk_registers', 'regulatory_updates'],
    outputTypes: [
      'compliance_report',
      'policy_draft',
      'risk_matrix',
      'kpi_framework',
      'governance_advice',
    ],
    dataSources: ['法规数据库', '内部制度库', '审计记录', '监管机构公告'],
    escalationTargets: ['prime_minister'],
    fallbackStrategy: '法规未明确时走保守解读；涉及跨境合规 → 联动锦衣卫拉取最新政策。',
    typicalTasks: [
      '数据合规年度审查',
      '风控体系搭建',
      'OKR 体系升级',
      '董事会治理诊断',
    ],
    confidenceBaseline: 0.85,
    realDataConnected: false,
  },

  gong_bu: {
    code: 'gong_bu',
    nameCn: '工部',
    nameEn: 'Works',
    tier: 'ministry',
    description: '产品 · 技术 · 架构 · 交付',
    emoji: '🛠',
    color: '#4A82F0',
    responsibilities: ['技术评估', '实施方案', 'PRD', '架构设计', '交付估算'],
    capabilities: [
      '产品需求分析与 PRD 撰写',
      '技术栈选型与评估',
      '架构设计与审查',
      'API 契约设计',
      '工程交付估算',
      '代码质量与安全审查',
    ],
    skills: [
      'requirement_analysis',
      'tech_selection',
      'architecture_design',
      'api_design',
      'effort_estimation',
      'code_review',
    ],
    inputTypes: [
      'user_stories',
      'tech_constraints',
      'existing_codebase',
      'non_functional_requirements',
    ],
    outputTypes: [
      'prd',
      'tech_design_doc',
      'api_contract',
      'delivery_timeline',
      'effort_estimate',
    ],
    dataSources: ['代码仓库', '技术文档', 'CI/CD 系统', '生产监控数据'],
    escalationTargets: ['prime_minister', 'xing_bu'],
    fallbackStrategy: '复杂技术选型 → 给出 2-3 个方案 + trade-off 表，由陛下决策。',
    typicalTasks: [
      '新系统架构设计',
      'MVP 12 周交付计划',
      'API 重构方案',
      '遗留系统迁移',
    ],
    confidenceBaseline: 0.82,
    realDataConnected: true,
  },

  /* ========== 专署 ========== */
  qin_tian_jian: {
    code: 'qin_tian_jian',
    nameCn: '钦天监',
    nameEn: 'Observatory',
    tier: 'special_bureau',
    description: '趋势 · 概率 · 情景 · 时机',
    emoji: '🔭',
    color: '#B794F4',
    responsibilities: ['趋势推演', '概率情景', '风险窗口', '预行动建议'],
    capabilities: [
      '中长期趋势预测（1-3 年）',
      '多情景概率建模（A/B/C）',
      '风险窗口识别',
      '战略时机判断',
      '预行动建议生成',
      '蝴蝶效应与连锁反应分析',
    ],
    skills: [
      'trend_forecasting',
      'scenario_modeling',
      'probability_estimation',
      'window_detection',
      'preemptive_planning',
    ],
    inputTypes: [
      'historical_data',
      'current_signals',
      'policy_context',
      'macro_indicators',
    ],
    outputTypes: [
      'forecast_report',
      'scenario_tree',
      'probability_distribution',
      'risk_window_alert',
      'preemptive_advice',
    ],
    dataSources: [
      '历史业绩数据库',
      '锦衣卫全球情报',
      '宏观经济数据',
      '行业研究报告',
    ],
    escalationTargets: ['prime_minister'],
    fallbackStrategy:
      '不确定性过高 → 拒绝单一预测，强制输出 A/B/C 三情景并标注概率区间。',
    typicalTasks: [
      '2027 年行业窗口推演',
      '政策拐点模型',
      '宏观流动性情景',
      '黑天鹅事件压力测试',
    ],
    confidenceBaseline: 0.65,
    realDataConnected: true,
  },

  jin_yi_wei: {
    code: 'jin_yi_wei',
    nameCn: '锦衣卫',
    nameEn: 'Imperial Guard',
    tier: 'special_bureau',
    description: '全球情报 · 舆情 · 信号 · 跨境',
    emoji: '🛰',
    color: '#FB923C',
    responsibilities: ['全球扫描', '舆情监测', '政策雷达', '跨境动态', '突发预警'],
    capabilities: [
      '全球 7×24 情报扫描',
      '多语言舆情分析',
      '跨境政策雷达',
      '突发事件实时预警',
      '来源可信度评级',
      '信号转派（一键分发到各部）',
    ],
    skills: [
      'global_scanning',
      'multilingual_sentiment',
      'policy_radar',
      'realtime_alerting',
      'source_validation',
      'signal_routing',
    ],
    inputTypes: [
      'news_feed',
      'social_media',
      'policy_sources',
      'industry_feeds',
      'government_bulletins',
    ],
    outputTypes: [
      'intel_signal',
      'weekly_brief',
      'critical_alert',
      'routing_recommendation',
    ],
    dataSources: [
      'Bloomberg Terminal',
      'Reuters',
      'Financial Times',
      '政府公报',
      '社交媒体 API',
      '行业垂直媒体',
    ],
    escalationTargets: ['bing_bu', 'qin_tian_jian', 'xing_bu'],
    fallbackStrategy: '单一来源信号 → 标记 low credibility，不单独触发任务；关键事件 → 同时推送多部。',
    typicalTasks: [
      '每周全球情报简报',
      '欧盟 AI Act 实时追踪',
      '突发地缘事件预警',
      '跨境投资环境扫描',
    ],
    confidenceBaseline: 0.72,
    realDataConnected: true,
  },

  tai_yi_yuan: {
    code: 'tai_yi_yuan',
    nameCn: '太医院',
    nameEn: 'Imperial Physician',
    tier: 'special_bureau',
    description: '健康 · 体检 · 风险分层 · 干预',
    emoji: '🌿',
    color: '#34D399',
    responsibilities: ['健康评分', '异常指标', '风险分层', '干预计划', '就诊建议', '医学问询'],
    capabilities: [
      '多维度健康评分（100 分制）',
      '体检指标异常识别',
      '疾病风险分层',
      '个性化干预计划',
      '就诊路径建议',
      '循证医学问询',
      '用药与运动建议',
    ],
    skills: [
      'health_scoring',
      'biomarker_analysis',
      'risk_stratification',
      'intervention_planning',
      'visit_recommendation',
      'medical_qa',
    ],
    inputTypes: [
      'biomarkers',
      'symptoms',
      'medical_history',
      'lifestyle_data',
      'wearable_telemetry',
    ],
    outputTypes: [
      'health_score',
      'risk_report',
      'intervention_plan',
      'visit_recommendation',
      'medical_answer',
    ],
    dataSources: [
      '电子病历 (EMR)',
      '可穿戴设备数据',
      '中国成人血脂/高血压指南',
      'AHA / ACC 循证医学库',
      'UpToDate',
    ],
    escalationTargets: ['xing_bu'],
    fallbackStrategy: '严重异常 → 强制建议专科就诊，不给诊疗结论；涉及处方 → 标记免责声明。',
    typicalTasks: [
      '陛下周体检解读',
      '慢病干预计划',
      'LDL 偏高管理',
      '高血压生活干预',
    ],
    confidenceBaseline: 0.85,
    realDataConnected: false,
  },
};

/** 按展示顺序排列（丞相居中，核心在两侧，专署最后） */
export const AGENT_DISPLAY_ORDER: AgentCode[] = [
  'prime_minister',
  'hu_bu',
  'gong_bu',
  'li_bu_rites',
  'bing_bu',
  'xing_bu',
  'li_bu',
  'jin_yi_wei',
  'qin_tian_jian',
  'tai_yi_yuan',
  'scribe',
];
