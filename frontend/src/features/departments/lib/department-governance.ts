export type MemorialUrgency = '急' | '要' | '常';
export type MemorialTriage = 'handled' | 'briefed' | 'verdict';

export type GovernanceMemorial = {
  id: string;
  title: string;
  triage: MemorialTriage;
  urgency: MemorialUrgency;
  cadence: string;
  gate: string;
  output?: string;
};

export type GovernanceBureau = {
  name: string;
  role: string;
  scope: string;
};

export type GovernanceConfig = {
  label: string;
  office: string;
  mission: string;
  memorials: GovernanceMemorial[];
  bureaus: GovernanceBureau[];
  riskLine: string;
};

export type ChancellorTriageLane = {
  id: string;
  title: string;
  label: string;
  rule: string;
  output: string;
};

export type ChancellorSummarySystem = {
  title: string;
  principle: string;
  lanes: ChancellorTriageLane[];
  escalationRule: string;
};

export const TRIAGE_LABEL: Record<MemorialTriage, string> = {
  handled: '已办',
  briefed: '汇报',
  verdict: '圣裁',
};

export const DEPARTMENT_MEMORIAL_FORMAT =
  '圣裁 / 关键事实 / 专业分析 / 异常警讯 / 缺失证据 / 风险红线 / 后令 / 来源 / 史馆索引';

export const CHANCELLOR_SUMMARY_SYSTEM: ChancellorSummarySystem = {
  title: '丞相汇总系统',
  principle: '只把需要老板判断取舍、承担风险或补关键证据的奏折推到御前。',
  lanes: [
    {
      id: 'handled',
      title: '丞相代办',
      label: '不呈',
      rule: '低风险、证据齐、无跨部冲突、已有既定流程。',
      output: '直接形成处理意见，只在日终汇报列一行。',
    },
    {
      id: 'briefed',
      title: '简报汇总',
      label: '汇报',
      rule: '影响经营但不需要老板立刻拍板，或已由部门按规则处理。',
      output: '压缩成处理意见、影响、后续观察点。',
    },
    {
      id: 'verdict',
      title: '必须圣裁',
      label: '圣裁',
      rule: '高风险、缺关键证据、跨部门冲突、对外承诺或单向门。',
      output: '进入今日御案，要求采纳、补证、复核或驳回。',
    },
  ],
  escalationRule: '凡涉及股权、合同、重大付款、对外报价、客户承诺、供应商锁定、真实交付，一律不得丞相静默代办。',
};

export const GOVERNANCE_BY_CODE: Record<string, GovernanceConfig> = {
  command: {
    label: '军机处',
    office: 'CEO Office / 战略经营中枢',
    mission: '把六部意见、经营信号和重大风险合成为老板可裁决的一页军机奏折。',
    memorials: [
      { id: 'boss-decision', title: '老板今日裁决奏折', triage: 'verdict', urgency: '急', cadence: '每日', gate: '今天哪三件事必须由老板拍板？', output: '圣裁、冲突、后令' },
      { id: 'conflict', title: '跨部门冲突奏折', triage: 'verdict', urgency: '急', cadence: '事件触发', gate: '哪个部门目标相互打架，谁让步？', output: '分歧、取舍、升级路径' },
      { id: 'major-project', title: '重大项目推进奏折', triage: 'briefed', urgency: '要', cadence: '每周', gate: '战略项目是否偏离目标、预算或时间？', output: '进度、阻塞、负责人' },
      { id: 'operating-risk', title: '经营风险奏折', triage: 'verdict', urgency: '要', cadence: '每周', gate: '哪些单向门风险必须人工确认？', output: '风险、边界、确认门' },
      { id: 'goal-gap', title: '年度目标偏差奏折', triage: 'briefed', urgency: '要', cadence: '每月', gate: 'OKR/KPI 与真实经营差距在哪里？', output: '偏差、原因、纠偏' },
      { id: 'strategy-situation', title: '战略态势奏折', triage: 'handled', urgency: '常', cadence: '每月/季度', gate: '行业、竞品、客户结构是否改变战略假设？', output: '态势、机会、威胁' },
    ],
    bureaus: [
      { name: '战略司', role: 'Strategy Office', scope: '方向、年度目标、业务组合' },
      { name: '作战司', role: 'PMO', scope: '重大项目、跨部门推进、阻塞清除' },
      { name: '经营司', role: 'BizOps', scope: '收入、利润、现金流、交付综合判断' },
      { name: '风险司', role: 'Enterprise Risk', scope: '单向门、尾部风险、人工确认' },
      { name: '复盘司', role: 'Management Review', scope: '会议纪要、复盘、纠偏' },
      { name: '情报司', role: 'Competitive Strategy', scope: '竞品、市场、客户、行业信号' },
    ],
    riskLine: '军机处只能合成裁决，不替专业部门伪造财务、法务、交付结论。',
  },
  finance: {
    label: '户部',
    office: 'CFO Office / 财务经营中台',
    mission: '把现金流、预算、报价、融资、审计和投资研究变成可追溯的财务奏折。',
    memorials: [
      { id: 'cashflow', title: '现金流奏折', triage: 'verdict', urgency: '急', cadence: '每日/每周', gate: '钱还能撑多久，哪里会断？', output: '现金、应收应付、runway' },
      { id: 'margin', title: '报价毛利奏折', triage: 'verdict', urgency: '急', cadence: '每单', gate: '这单能不能接，最低价是多少？', output: '成本、毛利、付款条件' },
      { id: 'financing', title: '融资奏折', triage: 'verdict', urgency: '要', cadence: '月度/事件', gate: '是否该融资、融多少、估值怎么谈？', output: '融资窗口、稀释、材料' },
      { id: 'budget', title: '预算奏折', triage: 'briefed', urgency: '要', cadence: '每月', gate: '钱花得是否符合计划？', output: '预算差异、超支、削减' },
      { id: 'audit', title: '审计会计奏折', triage: 'briefed', urgency: '要', cadence: '月度/季度', gate: '账是否干净，凭证缺口在哪？', output: '异常科目、凭证、内控' },
      { id: 'investment', title: '投资股票奏折', triage: 'handled', urgency: '常', cadence: '每周/事件', gate: '只做研究与风险提示，不自动交易。', output: '基本面、估值、仓位边界' },
      { id: 'metrics', title: '经营指标奏折', triage: 'handled', urgency: '常', cadence: '每周/月', gate: '公司是否真的变好？', output: '收入、毛利、回款、人效' },
    ],
    bureaus: [
      { name: '国库司', role: 'Treasury', scope: '现金流、账户、应收应付、资金计划' },
      { name: '度支司', role: 'FP&A', scope: '预算、预测、费用控制、经营分析' },
      { name: '盐铁司', role: 'Revenue Finance', scope: '报价、毛利、收入质量、客户利润' },
      { name: '融资司', role: 'Corporate Finance', scope: '融资、估值、投资人材料、稀释' },
      { name: '审计司', role: 'Internal Audit', scope: '异常科目、凭证、内控、舞弊风险' },
      { name: '会计司', role: 'Accounting / Tax', scope: '记账、报表、税务基础' },
      { name: '投资司', role: 'Investment Research', scope: '股票、基金、行业、资产配置研究' },
    ],
    riskLine: '没有来源、时间、公式和可信度的数字，禁止进入圣裁建议。',
  },
  ops: {
    label: '兵部',
    office: 'CRO Office / 市场销售增长中心',
    mission: '把客户、商机、渠道、竞争和增长漏斗转成可执行的攻防奏折。',
    memorials: [
      { id: 'opportunity', title: '商机推进奏折', triage: 'verdict', urgency: '急', cadence: '每日/每周', gate: '哪个客户本周最该推进，下一步找谁？', output: '客户、阶段、下一步' },
      { id: 'decision-chain', title: '大客户决策链奏折', triage: 'verdict', urgency: '急', cadence: '每单', gate: '谁拍板、谁影响、谁反对？', output: '决策链、反对者、突破口' },
      { id: 'competition-price', title: '竞品压价奏折', triage: 'briefed', urgency: '要', cadence: '事件触发', gate: '竞品打法是否改变我们的价格边界？', output: '竞品、价格、应对' },
      { id: 'forecast', title: '销售预测奏折', triage: 'briefed', urgency: '要', cadence: '每周/月', gate: '预测收入是否真实，漏斗哪里虚高？', output: '预测、缺口、概率' },
      { id: 'channel-quality', title: '渠道质量奏折', triage: 'briefed', urgency: '要', cadence: '每月', gate: '渠道带来利润还是噪音？', output: '渠道质量、利润、淘汰' },
      { id: 'market-chance', title: '市场机会奏折', triage: 'handled', urgency: '常', cadence: '每月', gate: '哪个市场值得投入兵力？', output: '机会、投入、胜率' },
      { id: 'churn-risk', title: '客户流失预警奏折', triage: 'handled', urgency: '常', cadence: '每周', gate: '哪些客户正在失温？', output: '流失信号、挽回动作' },
    ],
    bureaus: [
      { name: '销售司', role: 'Sales', scope: '商机、客户推进、成交路径' },
      { name: '市场司', role: 'Marketing', scope: '需求、定位、线索、活动' },
      { name: '渠道司', role: 'Channel', scope: '经销商、代理、伙伴' },
      { name: '客户司', role: 'Key Account', scope: '大客户关系、决策链' },
      { name: '竞情司', role: 'Competitive Intel', scope: '竞品、价格、打法' },
      { name: '增长司', role: 'RevOps / Growth', scope: '漏斗、转化、复购、预测' },
    ],
    riskLine: '兵部不得只报乐观商机，必须同时报决策链缺口和失败路径。',
  },
  personnel: {
    label: '吏部',
    office: 'CHRO / 组织干部管理',
    mission: '把责任人、组织能力、绩效偏差和干部风险转成可执行的人事奏折。',
    memorials: [
      { id: 'owner', title: '责任人奏折', triage: 'verdict', urgency: '急', cadence: '事件触发', gate: '这件事谁负责、谁审批、谁兜底？', output: 'RACI、责任人、期限' },
      { id: 'org-capability', title: '组织能力奏折', triage: 'verdict', urgency: '急', cadence: '每周', gate: '当前组织能不能承接这个目标？', output: '能力缺口、补强' },
      { id: 'cadre', title: '干部任免奏折', triage: 'briefed', urgency: '要', cadence: '月度/事件', gate: '谁该升、谁该换、谁是单点？', output: '任免、继任、风险' },
      { id: 'performance', title: '绩效偏差奏折', triage: 'briefed', urgency: '要', cadence: '每月', gate: '指标偏差是人、流程还是目标问题？', output: '偏差、原因、纠偏' },
      { id: 'headcount', title: '招聘编制奏折', triage: 'briefed', urgency: '要', cadence: '每月', gate: '该招什么人，不招会卡哪里？', output: 'HC、岗位、优先级' },
      { id: 'raci', title: '跨部门协同奏折', triage: 'handled', urgency: '常', cadence: '每周', gate: 'RACI 是否清楚，交接是否断裂？', output: '协同、交接、卡点' },
      { id: 'team-risk', title: '团队风险奏折', triage: 'handled', urgency: '常', cadence: '每月', gate: '士气、负荷、流失风险在哪里？', output: '负荷、流失、士气' },
    ],
    bureaus: [
      { name: '任免司', role: 'Talent / Cadre', scope: '负责人、晋升、替换、继任' },
      { name: '绩效司', role: 'Performance', scope: 'KPI、OKR、绩效偏差' },
      { name: '编制司', role: 'Workforce Planning', scope: '招聘、HC、组织结构' },
      { name: '培训司', role: 'L&D', scope: '能力建设、干部培养' },
      { name: '协同司', role: 'Org Ops', scope: 'RACI、跨部门协作' },
      { name: '文化司', role: 'Culture', scope: '价值观、执行力、团队状态' },
    ],
    riskLine: '没有责任人和截止时间的后令，不得进入执行态。',
  },
  gongbu: {
    label: '工部',
    office: 'CTO / COO / 研发交付供应链',
    mission: '把产品、技术、交付、供应链、产能和质量转成可验收的交付奏折。',
    memorials: [
      { id: 'delivery', title: '交付排期奏折', triage: 'verdict', urgency: '急', cadence: '每日/每周', gate: '交期是否真实，哪个节点会拖？', output: '排期、节点、阻塞' },
      { id: 'quality', title: '质量异常奏折', triage: 'verdict', urgency: '急', cadence: '事件触发', gate: '缺陷是否影响客户、验收或品牌？', output: '缺陷、影响、修复' },
      { id: 'tech-risk', title: '技术风险奏折', triage: 'briefed', urgency: '要', cadence: '每周', gate: '架构、性能、安全债是否会爆？', output: '风险、债务、方案' },
      { id: 'supply', title: '供应链风险奏折', triage: 'verdict', urgency: '要', cadence: '每周/月', gate: '供应商、物料、BOM 是否可控？', output: '供应、替代、锁定' },
      { id: 'bom-cost', title: 'BOM 成本奏折', triage: 'briefed', urgency: '要', cadence: '每单/每月', gate: '成本结构是否支持报价和毛利？', output: 'BOM、成本、毛利' },
      { id: 'roadmap', title: '产品路线奏折', triage: 'handled', urgency: '常', cadence: '每月', gate: '路线图是否服务真实客户和战略？', output: '路线、优先级、取舍' },
      { id: 'capacity', title: '产能瓶颈奏折', triage: 'handled', urgency: '常', cadence: '每周/月', gate: '产能瓶颈在设备、人还是流程？', output: '产能、瓶颈、补强' },
    ],
    bureaus: [
      { name: '产品司', role: 'Product', scope: '需求、路线图、优先级' },
      { name: '技术司', role: 'Engineering', scope: '架构、研发、工程质量' },
      { name: '交付司', role: 'Delivery / PM', scope: '项目交付、排期、验收' },
      { name: '供应司', role: 'Supply Chain', scope: '供应商、物料、BOM' },
      { name: '制造司', role: 'Operations', scope: '产能、工艺、生产' },
      { name: '质量司', role: 'QA / Quality', scope: '缺陷、测试、质量门禁' },
    ],
    riskLine: '触碰真实交付、BOM、报价、供应商锁定时，必须走后端产线引擎。',
  },
  legal: {
    label: '刑部',
    office: 'Legal / Risk / Compliance',
    mission: '把合同、合规、授权、安全和争议转成有红线的风控奏折。',
    memorials: [
      { id: 'contract', title: '合同风险奏折', triage: 'verdict', urgency: '急', cadence: '每单/事件', gate: '违约、赔偿、排他、验收条款是否可承受？', output: '条款、红线、修订' },
      { id: 'commitment', title: '客户承诺奏折', triage: 'verdict', urgency: '急', cadence: '事件触发', gate: '对外承诺是否越权或不可逆？', output: '承诺、权限、边界' },
      { id: 'payment-risk', title: '重大付款风险奏折', triage: 'verdict', urgency: '要', cadence: '每单', gate: '预付款、账期、违约金是否需人工确认？', output: '付款、账期、确认门' },
      { id: 'compliance', title: '合规审查奏折', triage: 'briefed', urgency: '要', cadence: '每月/事件', gate: '行业监管和数据边界是否满足？', output: '法规、资质、缺口' },
      { id: 'supplier-lock', title: '供应商锁定奏折', triage: 'briefed', urgency: '要', cadence: '事件触发', gate: '独家、锁价、锁量是否构成单向门？', output: '锁定、替代、退出' },
      { id: 'data-security', title: '数据安全奏折', triage: 'handled', urgency: '常', cadence: '每周/月', gate: '权限、数据、审计日志是否完整？', output: '权限、日志、整改' },
      { id: 'signoff', title: '人工确认奏折', triage: 'handled', urgency: '常', cadence: '持续', gate: '哪些动作必须老板或法务签字？', output: '签字人、门槛、记录' },
    ],
    bureaus: [
      { name: '合同司', role: 'Legal Contract', scope: '条款、违约责任、验收边界' },
      { name: '合规司', role: 'Compliance', scope: '法规、行业监管、资质' },
      { name: '风控司', role: 'Risk Control', scope: '高风险动作、单向门' },
      { name: '安全司', role: 'Security', scope: '数据、安全、权限' },
      { name: '争议司', role: 'Dispute', scope: '纠纷、赔偿、诉讼' },
      { name: '授权司', role: 'Approval Gate', scope: '审批、签字、人工确认' },
    ],
    riskLine: '高风险承诺、股权、合同、付款、对外报价禁止静默采纳。',
  },
  market: {
    label: '礼部',
    office: 'Brand / PR / Customer Communication',
    mission: '把品牌、客户沟通、公关、内容和体验转成稳妥的对外奏折。',
    memorials: [
      { id: 'customer-comms', title: '客户沟通奏折', triage: 'verdict', urgency: '急', cadence: '每单/事件', gate: '客户听完会怎么理解，是否形成承诺？', output: '话术、承诺、下一步' },
      { id: 'crisis-pr', title: '危机公关奏折', triage: 'verdict', urgency: '急', cadence: '事件触发', gate: '外部舆情是否需要统一口径？', output: '口径、节奏、责任人' },
      { id: 'brand-voice', title: '品牌口径奏折', triage: 'briefed', urgency: '要', cadence: '每月/事件', gate: '这句话是否符合定位和长期信任？', output: '定位、措辞、禁区' },
      { id: 'meeting-minutes', title: '会议纪要奏折', triage: 'briefed', urgency: '要', cadence: '每会', gate: '纪要是否清楚承诺、责任和下一步？', output: '纪要、后令、承诺' },
      { id: 'statement', title: '对外声明奏折', triage: 'verdict', urgency: '要', cadence: '事件触发', gate: '声明是否经刑部和军机处会签？', output: '声明、会签、风险' },
      { id: 'customer-success', title: '客户成功奏折', triage: 'handled', urgency: '常', cadence: '每周/月', gate: '客户是否真正获得结果？', output: '结果、满意度、续约' },
      { id: 'content', title: '内容发布奏折', triage: 'handled', urgency: '常', cadence: '每周', gate: '案例、文章、材料是否可发布？', output: '素材、审校、发布' },
    ],
    bureaus: [
      { name: '品牌司', role: 'Brand', scope: '定位、品牌表达、命名' },
      { name: '公关司', role: 'PR', scope: '舆情、媒体、危机' },
      { name: '客户沟通司', role: 'Customer Comms', scope: '邮件、话术、会议纪要' },
      { name: '政企司', role: 'Gov / Enterprise Relations', scope: '政企关系、外部合作' },
      { name: '内容司', role: 'Content', scope: '案例、文章、材料' },
      { name: '体验司', role: 'Customer Experience', scope: '反馈、满意度、续约体验' },
    ],
    riskLine: '礼部所有对外表达都要区分事实、承诺和愿景，不替法务越权背书。',
  },
};

export const GOVERNANCE_ALIASES: Record<string, string> = {
  hubu: 'finance',
  bingbu: 'ops',
  libu_hr: 'personnel',
  works: 'gongbu',
  libu_rites: 'market',
  libu: 'market',
  guard: 'guard',
  physician: 'physician',
};

export function getDepartmentGovernance(code?: string, fallbackLabel = '部院'): GovernanceConfig {
  const normalized = code ? (GOVERNANCE_ALIASES[code] ?? code) : 'command';
  if (normalized === 'guard') {
    return {
      ...GOVERNANCE_BY_CODE.legal,
      label: '锦衣卫',
      office: 'Intel / Audit / Competitive Recon',
      mission: '负责外部情报、内部异常、证据核验和暗线风险，不替业务部门下结论。',
    };
  }
  if (normalized === 'physician') {
    return {
      ...GOVERNANCE_BY_CODE.gongbu,
      label: '太医院',
      office: 'Health / Reliability / System Doctor',
      mission: '负责系统健康、可靠性、告警、可观测性和修复建议。',
    };
  }
  return GOVERNANCE_BY_CODE[normalized] ?? { ...GOVERNANCE_BY_CODE.command, label: fallbackLabel };
}
