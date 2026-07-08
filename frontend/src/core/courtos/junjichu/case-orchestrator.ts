export type JunjichuIntentType =
  | 'live_intelligence'
  | 'finance_decision'
  | 'travel_event'
  | 'customer_revenue'
  | 'legal_risk'
  | 'technical_delivery'
  | 'general_review';

export type JunjichuDepartmentCode =
  | 'prime_minister'
  | 'jin_yi_wei'
  | 'hu_bu'
  | 'bing_bu'
  | 'xing_bu'
  | 'gong_bu'
  | 'qin_tian_jian'
  | 'li_bu_rites'
  | 'scribe';

export type JunjichuEvidencePolicy = 'url_required' | 'business_evidence_required' | 'internal_ok';
export type JunjichuWorkstreamStatus = 'queued' | 'working' | 'waiting_evidence' | 'ready';

export interface PrimeEvidenceDispatchPlan {
  intentType: JunjichuIntentType;
  title: string;
  objective: string;
  primaryDepartment: JunjichuDepartmentCode;
  departments: JunjichuDepartmentCode[];
  swarms: string[];
  advisors: string[];
  evidencePolicy: JunjichuEvidencePolicy;
  qualityGates: string[];
  requiredReturnSections: string[];
  answerFormat: string;
  userFacingReason: string;
}

export interface JunjichuCaseWorkstream {
  id: string;
  department: JunjichuDepartmentCode;
  agentName: string;
  mission: string;
  status: JunjichuWorkstreamStatus;
  progressPct: number;
  dependencies: string[];
  expectedOutput: string;
}

export interface JunjichuCaseQualityGate {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  reason: string;
}

export interface JunjichuCaseFile {
  caseId: string;
  taskId: string;
  title: string;
  originalCommand: string;
  objective: string;
  status: 'planning';
  sourceLabel: 'MIXED';
  createdAt: string;
  plan: PrimeEvidenceDispatchPlan;
  workstreams: JunjichuCaseWorkstream[];
  qualityGates: JunjichuCaseQualityGate[];
  progressPct: number;
  returnPolicy: {
    firstScreen: string[];
    memorialSections: string[];
    evidenceRule: string;
  };
  nextActions: string[];
}

const DEPARTMENT_LABEL: Record<JunjichuDepartmentCode, string> = {
  prime_minister: '丞相',
  jin_yi_wei: '锦衣卫',
  hu_bu: '户部',
  bing_bu: '兵部',
  xing_bu: '刑部',
  gong_bu: '工部',
  qin_tian_jian: '钦天监',
  li_bu_rites: '礼部',
  scribe: '史官',
};

const WORKSTREAM_BLUEPRINT: Record<
  JunjichuDepartmentCode,
  Omit<JunjichuCaseWorkstream, 'id' | 'department' | 'status' | 'progressPct' | 'dependencies'>
> = {
  prime_minister: {
    agentName: '丞相拟旨官',
    mission: '收束原始下旨，拆成可裁决目标、部门分工和回奏格式。',
    expectedOutput: '拟旨卡、任务边界、圣裁候选',
  },
  jin_yi_wei: {
    agentName: '锦衣卫情报校验官',
    mission: '采集外部来源、交叉验证可信度，标出未知和冲突证据。',
    expectedOutput: '来源清单、可信度、缺证清单',
  },
  hu_bu: {
    agentName: '户部价值官',
    mission: '测算预算、ROI、现金流压力和最小可下注方案。',
    expectedOutput: '成本收益表、预算边界、下注建议',
  },
  bing_bu: {
    agentName: '兵部市场战情官',
    mission: '判断客户、竞争、渠道、机会窗口和攻守次序。',
    expectedOutput: '战情判断、客户路径、竞争风险',
  },
  xing_bu: {
    agentName: '刑部风险官',
    mission: '审合同、承诺、付款、法律责任和人工确认红线。',
    expectedOutput: '风险红线、签署禁区、确认门',
  },
  gong_bu: {
    agentName: '工部交付官',
    mission: '拆技术实现、系统依赖、工期和可验收交付物。',
    expectedOutput: '实现路径、依赖、验收标准',
  },
  qin_tian_jian: {
    agentName: '钦天监时势官',
    mission: '判断时效、趋势、场景概率和不可知边界。',
    expectedOutput: '时效判断、情景分支、不确定性',
  },
  li_bu_rites: {
    agentName: '礼部呈现官',
    mission: '把多部门判断整理成用户能直接行动的表达和行程/沟通方案。',
    expectedOutput: '用户版结论、表达方案、行动清单',
  },
  scribe: {
    agentName: '史官归档官',
    mission: '记录证据、裁决、结果和后续可复用旧案。',
    expectedOutput: '归档索引、复盘字段、引用标签',
  },
};

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

function includesAny(command: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(command));
}

function shortTitle(command: string, fallback: string): string {
  const clean = normalizeCommand(command);
  if (!clean) return fallback;
  return clean.length > 30 ? `${clean.slice(0, 30)}...` : clean;
}

function basePlan(command: string): PrimeEvidenceDispatchPlan {
  return {
    intentType: 'general_review',
    title: shortTitle(command, '军机处综合会审'),
    objective: `把“${normalizeCommand(command)}”转成可裁决回奏：结论、证据、风险、缺口、下一步。`,
    primaryDepartment: 'prime_minister',
    departments: ['prime_minister', 'jin_yi_wei', 'qin_tian_jian', 'scribe'],
    swarms: ['intent_clarifier', 'source_check', 'risk_scan', 'memorial_writer'],
    advisors: ['drucker', 'munger', 'deming'],
    evidencePolicy: 'internal_ok',
    qualityGates: ['clear_decision_goal', 'risk_boundary_declared', 'next_action_single'],
    requiredReturnSections: ['圣裁', '分奏', '证据', '缺证', '风险', '后令', '质门', '来源'],
    answerFormat: '先给可裁决结论，再列证据和下一步。',
    userFacingReason: '丞相先定目标，锦衣卫补证，钦天监标不确定性，史官保留闭环。',
  };
}

export function buildPrimeEvidenceDispatchPlan(input: { command: string }): PrimeEvidenceDispatchPlan {
  const command = normalizeCommand(input.command);
  const plan = basePlan(command);

  if (
    includesAny(command, [
      /今天|昨日|最新|最近|发生|新闻|大事|实时|当前|now|today|latest|news/i,
      /AI|人工智能|大模型|OpenAI|Anthropic|Gemini|算力|芯片/i,
    ])
  ) {
    return {
      ...plan,
      intentType: 'live_intelligence',
      title: shortTitle(command, '今日情报会审'),
      primaryDepartment: 'jin_yi_wei',
      departments: ['prime_minister', 'jin_yi_wei', 'gong_bu', 'qin_tian_jian', 'li_bu_rites', 'scribe'],
      swarms: ['source_collect', 'source_verify', 'timeline_builder', 'impact_analysis', 'brief_writer'],
      advisors: ['karpathy', 'andrew-ng', 'bruce-schneier', 'daniel-kahneman'],
      evidencePolicy: 'url_required',
      qualityGates: ['source_urls_required', 'two_source_crosscheck', 'freshness_window_declared', 'impact_not_hype'],
      answerFormat: '按重要性排序：发生了什么、来源、为什么重要、对你有什么行动建议。',
      userFacingReason: '这是实时情报题，必须先由锦衣卫采源验真，再让工部和钦天监判断技术与时势影响。',
    };
  }

  if (includesAny(command, [/世界杯|球赛|比赛|门票|签证|酒店|航班|行程|旅行|去看|world cup|ticket|visa|hotel|flight/i])) {
    return {
      ...plan,
      intentType: 'travel_event',
      title: shortTitle(command, '出行观赛会审'),
      primaryDepartment: 'li_bu_rites',
      departments: ['prime_minister', 'li_bu_rites', 'hu_bu', 'jin_yi_wei', 'qin_tian_jian', 'scribe'],
      swarms: ['schedule_lookup', 'travel_budget', 'risk_watch', 'source_verify', 'itinerary_writer'],
      advisors: ['jeff-bezos', 'daniel-kahneman', 'zhangxiaolong'],
      evidencePolicy: 'url_required',
      qualityGates: ['official_schedule_required', 'budget_range_required', 'travel_risk_checked', 'decision_options_clear'],
      answerFormat: '给出能不能去、怎么买最稳、预算、风险、下一步。',
      userFacingReason: '这是行程决策题，礼部负责体验，户部控预算，锦衣卫验来源，钦天监看时间窗口。',
    };
  }

  if (includesAny(command, [/预算|成本|报价|ROI|回本|付款|投资|利润|现金流|采购|供应商|财务|price|cost|budget/i])) {
    return {
      ...plan,
      intentType: 'finance_decision',
      title: shortTitle(command, '户部价值会审'),
      primaryDepartment: 'hu_bu',
      departments: ['prime_minister', 'hu_bu', 'jin_yi_wei', 'xing_bu', 'bing_bu', 'scribe'],
      swarms: ['financial_source_collect', 'budget_review', 'risk_gate', 'market_check', 'memorial_writer'],
      advisors: ['howard-marks-perspective', 'jeff-bezos-perspective', 'bruce-schneier'],
      evidencePolicy: 'business_evidence_required',
      qualityGates: ['assumptions_explicit', 'downside_case_required', 'no_binding_quote_without_signoff', 'source_traceable'],
      answerFormat: '先给值不值得做，再给数字假设、下行保护和需要补的证据。',
      userFacingReason: '这是价值判断题，户部主审钱，锦衣卫验数字来源，刑部挡承诺风险，兵部看市场回款。',
    };
  }

  if (includesAny(command, [/合同|法务|违约|签字|独家|承诺|责任|诉讼|合规|股权|预付款|contract|legal/i])) {
    return {
      ...plan,
      intentType: 'legal_risk',
      title: shortTitle(command, '刑部风险会审'),
      primaryDepartment: 'xing_bu',
      departments: ['prime_minister', 'xing_bu', 'hu_bu', 'jin_yi_wei', 'scribe'],
      swarms: ['clause_review', 'commitment_scan', 'evidence_verify', 'signoff_gate'],
      advisors: ['bruce-schneier', 'stuart-russell', 'munger-perspective'],
      evidencePolicy: 'business_evidence_required',
      qualityGates: ['human_signoff_required', 'liability_boundary_declared', 'missing_clause_listed', 'no_silent_commitment'],
      answerFormat: '先列能不能签/能不能承诺，再列红线、缺条款、补证。',
      userFacingReason: '这是高风险题，刑部必须先设人工确认门，户部和锦衣卫只提供证据与金额边界。',
    };
  }

  if (includesAny(command, [/客户|销售|渠道|成交|竞品|市场|获客|招商|增长|deal|sales|customer|market/i])) {
    return {
      ...plan,
      intentType: 'customer_revenue',
      title: shortTitle(command, '兵部战情会审'),
      primaryDepartment: 'bing_bu',
      departments: ['prime_minister', 'bing_bu', 'hu_bu', 'xing_bu', 'jin_yi_wei', 'li_bu_rites', 'scribe'],
      swarms: ['customer_map', 'competitor_scan', 'offer_design', 'risk_gate', 'message_writer'],
      advisors: ['aaron-ross', 'neil-rackham', 'jeff-bezos-perspective'],
      evidencePolicy: 'business_evidence_required',
      qualityGates: ['customer_need_evidence', 'unit_economics_checked', 'promise_risk_checked', 'next_step_has_owner'],
      answerFormat: '先给打法，再给目标客户、报价/价值、风险和下一步话术。',
      userFacingReason: '这是收入题，兵部主审打法，户部算账，刑部控承诺，礼部把话讲清楚。',
    };
  }

  if (includesAny(command, [/系统|接口|代码|agent|智能体|蜂群|架构|上线|交付|实现|bug|API|build|deploy/i])) {
    return {
      ...plan,
      intentType: 'technical_delivery',
      title: shortTitle(command, '工部交付会审'),
      primaryDepartment: 'gong_bu',
      departments: ['prime_minister', 'gong_bu', 'jin_yi_wei', 'qin_tian_jian', 'hu_bu', 'scribe'],
      swarms: ['system_design', 'dependency_map', 'test_gate', 'cost_check', 'release_writer'],
      advisors: ['karpathy-perspective', 'harrison-chase', 'charity-majors'],
      evidencePolicy: 'business_evidence_required',
      qualityGates: ['acceptance_test_defined', 'dependency_visible', 'failure_mode_declared', 'source_traceable'],
      answerFormat: '先给能否实现，再给架构、任务拆分、验收和风险。',
      userFacingReason: '这是交付题，工部主审实现，锦衣卫查依赖和事实，钦天监看不确定性，户部控成本。',
    };
  }

  return plan;
}

function buildWorkstreams(plan: PrimeEvidenceDispatchPlan): JunjichuCaseWorkstream[] {
  return plan.departments.map((department, index) => {
    const blueprint = WORKSTREAM_BLUEPRINT[department];
    const isPrimary = department === plan.primaryDepartment;
    const status: JunjichuWorkstreamStatus = index === 0 || isPrimary ? 'working' : 'queued';
    const progressPct = index === 0 ? 30 : isPrimary ? 24 : 8;
    return {
      id: `ws_${department}`,
      department,
      ...blueprint,
      mission: isPrimary ? `${blueprint.mission}（本案主责）` : blueprint.mission,
      status,
      progressPct,
      dependencies: department === 'prime_minister' ? [] : ['prime_minister'],
    };
  });
}

function buildQualityGates(plan: PrimeEvidenceDispatchPlan): JunjichuCaseQualityGate[] {
  return plan.qualityGates.map((gate, index) => ({
    id: gate,
    label: gate,
    passed: false,
    blocking: index < 2 || gate.includes('signoff') || gate.includes('source') || gate.includes('evidence'),
    reason: gate.includes('source') || gate.includes('evidence')
      ? '等待锦衣卫或业务证据补齐后才能通过。'
      : '等待对应部门产出后复核。',
  }));
}

export function buildJunjichuCaseFile(input: {
  command: string;
  userId: string;
  now?: string;
  caseId?: string;
}): JunjichuCaseFile {
  const originalCommand = normalizeCommand(input.command);
  if (!originalCommand) throw new Error('command is required');

  const now = input.now ?? new Date().toISOString();
  const caseId = input.caseId ?? `jjc_${crypto.randomUUID()}`;
  const plan = buildPrimeEvidenceDispatchPlan({ command: originalCommand });
  const workstreams = buildWorkstreams(plan);
  const qualityGates = buildQualityGates(plan);
  const progressPct = Math.round(workstreams.reduce((sum, item) => sum + item.progressPct, 0) / workstreams.length);

  return {
    caseId,
    taskId: caseId,
    title: plan.title,
    originalCommand,
    objective: plan.objective,
    status: 'planning',
    sourceLabel: 'MIXED',
    createdAt: now,
    plan: {
      ...plan,
      departments: uniq(plan.departments),
      swarms: uniq(plan.swarms),
      advisors: uniq(plan.advisors),
    },
    workstreams,
    qualityGates,
    progressPct,
    returnPolicy: {
      firstScreen: ['结论先行', '证据来源', '风险边界', '唯一下一步'],
      memorialSections: plan.requiredReturnSections,
      evidenceRule:
        plan.evidencePolicy === 'url_required'
          ? '每个事实判断必须带 URL 或明确写“未找到可靠来源”。'
          : plan.evidencePolicy === 'business_evidence_required'
            ? '数字、报价、合同、客户判断必须标出业务证据来源；缺证不得给确定性结论。'
            : '内部判断可以先行，但风险和缺证必须明示。',
    },
    nextActions: [
      `${DEPARTMENT_LABEL[plan.primaryDepartment]}先出主审意见`,
      '锦衣卫补齐来源和可信度',
      '丞相整合成可圣裁回奏',
    ],
  };
}

export function getJunjichuDepartmentLabel(code: JunjichuDepartmentCode): string {
  return DEPARTMENT_LABEL[code] ?? code;
}
