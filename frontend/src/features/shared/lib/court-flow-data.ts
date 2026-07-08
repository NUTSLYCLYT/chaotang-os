import type { AgentState, RiskLevel } from '@/types/agent';

export type GovernanceStage = '中书起草' | '门下复核' | '尚书下发' | '庄园承接';
export type ManorDomain = 'sales' | 'marketing' | 'ecommerce';

export interface TraceEvent {
  id: string;
  title: string;
  detail: string;
  at: string;
  owner: string;
  state: AgentState;
}

export interface LinkedArtifact {
  label: string;
  kind: '奏章' | '批示' | '回写' | '蜂群纪要';
  href: string;
}

export interface GovernanceCase {
  id: string;
  title: string;
  risk: RiskLevel;
  stage: GovernanceStage;
  summary: string;
  next: string;
  manorDomain: ManorDomain;
  objective: string;
  judgment: string;
  traceId: string;
  linkedArtifacts: LinkedArtifact[];
  timeline: TraceEvent[];
  scribePack: {
    title: string;
    summary: string;
    owner: string;
  };
  directive: {
    title: string;
    lines: string[];
    source: string;
  };
}

export interface ManorExecution {
  domain: ManorDomain;
  title: string;
  summary: string;
  cooperation: string;
  queueState: string;
  objective: string;
  writeback: string;
  traceId: string;
  linkedCaseId: string;
  linkedArtifacts: LinkedArtifact[];
  timeline: TraceEvent[];
  workbench: {
    lane: string;
    owner: string;
    state: AgentState;
    detail: string;
  }[];
  writebackSummary: {
    title: string;
    value: string;
    note: string;
  }[];
  actionBoard: {
    today: string[];
    blockers: string[];
    escalations: string[];
  };
}

export const GOVERNANCE_CASES: GovernanceCase[] = [
  {
    id: 'GV-2104',
    title: '高价值商机是否进入加急通道',
    risk: 'high',
    stage: '中书起草',
    summary: '户部与兵部主张尽快推进，刑部要求先补风险边界。',
    next: '门下复核',
    manorDomain: 'sales',
    objective: '在不突破合规边界的前提下，把高价值线索导入销售庄园的快车队列。',
    judgment: '先保高意图回款，再控制承诺边界，允许销售庄园进入加急试运行。',
    traceId: 'trace-sales-2104',
    linkedArtifacts: [
      { label: '中书草案 · 加急通道边界', kind: '奏章', href: '/reports' },
      { label: '刑部会签 · 风险边界批示', kind: '批示', href: '/study/xingbu' },
      { label: '销售庄园 · 回写纪要', kind: '回写', href: '/manors' },
    ],
    timeline: [
      {
        id: 'gv-2104-1',
        title: '丞相收敛判断',
        detail: '将户部增长主张与刑部边界要求压缩成单一议题。',
        at: '辰时',
        owner: '丞相台',
        state: 'summarizing',
      },
      {
        id: 'gv-2104-2',
        title: '中书起草',
        detail: '起草快车队列准入标准、承诺上限与回写要求。',
        at: '巳时',
        owner: '中书省',
        state: 'running',
      },
      {
        id: 'gv-2104-3',
        title: '待门下复核',
        detail: '等待刑部与礼部完成边界与口径复核。',
        at: '午时',
        owner: '门下省',
        state: 'waiting_dependency',
      },
    ],
    scribePack: {
      title: '高价值商机加急治理专题包',
      summary: '收录边界条件、放行标准、快车队列结果和回款表现，供后续相似商机复用。',
      owner: '史官 / 户部 / NotebookLM',
    },
    directive: {
      title: '快车队列放行批示',
      source: '丞相台初判 -> 中书草拟 -> 门下复核后成文',
      lines: [
        '允许销售庄园先行承接高意图高置信度线索。',
        '未补齐刑部边界前，不得扩大承诺范围。',
        '每日回写回款预测、升级原因和边界冲突项。',
      ],
    },
  },
  {
    id: 'GV-2109',
    title: '跨境经营信号是否升级为正式议题',
    risk: 'medium',
    stage: '门下复核',
    summary: '远洋部信号已成熟，但礼部要求先统一对外口径。',
    next: '尚书下发',
    manorDomain: 'ecommerce',
    objective: '把跨境经营机会从情报级信号升级为电商庄园的正式实验议题。',
    judgment: '允许进入电商庄园试验，但先统一品牌与跨境合规口径。',
    traceId: 'trace-ecommerce-2109',
    linkedArtifacts: [
      { label: '锦衣卫情报摘录', kind: '奏章', href: '/intel' },
      { label: '礼部统一口径批示', kind: '批示', href: '/study/libu_rites' },
      { label: '电商庄园试验回写', kind: '回写', href: '/manors' },
    ],
    timeline: [
      {
        id: 'gv-2109-1',
        title: '情报升格',
        detail: '跨境信号由锦衣卫上报，丞相判断具备升格条件。',
        at: '昨日酉时',
        owner: '锦衣卫 / 丞相台',
        state: 'completed',
      },
      {
        id: 'gv-2109-2',
        title: '门下驳议',
        detail: '礼部要求先统一外部口径，刑部要求明确跨境合规线。',
        at: '今晨卯时',
        owner: '门下省',
        state: 'running',
      },
      {
        id: 'gv-2109-3',
        title: '待尚书派发',
        detail: '复核通过后将下发至电商庄园试验蜂群。',
        at: '今日申时',
        owner: '尚书省',
        state: 'assigned',
      },
    ],
    scribePack: {
      title: '跨境经营受控试验专题包',
      summary: '沉淀跨境试验口径、渠道样本、合规边界和现金流预测，作为后续跨境判断先例。',
      owner: '史官 / 礼部 / NotebookLM',
    },
    directive: {
      title: '跨境试验受控派发批示',
      source: '锦衣卫情报 -> 丞相升格 -> 门下驳议后定稿',
      lines: [
        '仅允许电商庄园按小样本方式试跑，不得直接全量铺开。',
        '礼部与刑部未统一口径前，不得公开夸大能力边界。',
        '试验完成后统一回写现金流、渠道表现与风险项。',
      ],
    },
  },
  {
    id: 'GV-2113',
    title: '官网增长实验资源是否调整优先级',
    risk: 'medium',
    stage: '尚书下发',
    summary: '工部与礼部已会签，待下发到营销庄园执行。',
    next: '庄园承接',
    manorDomain: 'marketing',
    objective: '将官网实验资源优先聚焦到高意图线索承接，减少低质量内容耗损。',
    judgment: '同意资源重排，营销庄园按高意图承接链优先执行，并回写转化质量。',
    traceId: 'trace-marketing-2113',
    linkedArtifacts: [
      { label: '官网实验议题草案', kind: '奏章', href: '/reports' },
      { label: '工部技术可行性批示', kind: '批示', href: '/study/gongbu' },
      { label: '营销庄园蜂群纪要', kind: '蜂群纪要', href: '/manors' },
    ],
    timeline: [
      {
        id: 'gv-2113-1',
        title: '丞相定调',
        detail: '将增长争议收敛为资源优先级重排，不再多线争抢。',
        at: '昨日戌时',
        owner: '丞相台',
        state: 'completed',
      },
      {
        id: 'gv-2113-2',
        title: '三省流转完成',
        detail: '中书、门下、尚书均已完成会签和派发准备。',
        at: '今晨巳时',
        owner: '三省',
        state: 'completed',
      },
      {
        id: 'gv-2113-3',
        title: '待庄园承接',
        detail: '营销庄园等待正式接令并开始回写实验进度。',
        at: '今日未时',
        owner: '营销庄园',
        state: 'assigned',
      },
    ],
    scribePack: {
      title: '官网增长实验重排专题包',
      summary: '记录资源优先级重排、落地页调整、表单质量变化和复盘结论。',
      owner: '史官 / 工部 / NotebookLM',
    },
    directive: {
      title: '官网实验资源重排批示',
      source: '丞相定调 -> 工部礼部会签 -> 尚书下发',
      lines: [
        '优先保障高意图承接链，不再平均分散资源。',
        '页面蜂群与内容蜂群需统一节奏联调。',
        '按日回写表单质量、入口点击与调整建议。',
      ],
    },
  },
];

export const MANOR_EXECUTIONS: ManorExecution[] = [
  {
    domain: 'sales',
    title: '销售庄园',
    summary: '把对外商机推进成成交与回款，是最直接的经营前线。',
    cooperation: '常联动户部、礼部、兵部',
    queueState: '高价值线索已进入快车队列，等待门下复核结果同步放行。',
    objective: '优先推进高意图、高回款确定性的线索，并保持承诺边界一致。',
    writeback: '每日回写线索评分、队列状态、预计回款与升级原因。',
    traceId: 'trace-sales-2104',
    linkedCaseId: 'GV-2104',
    linkedArtifacts: [
      { label: '快车队列名单', kind: '蜂群纪要', href: '/reports' },
      { label: '销售回写清单', kind: '回写', href: '/scribe' },
    ],
    timeline: [
      {
        id: 'sales-1',
        title: '接令入队',
        detail: '尚书省已准备派发，高价值线索进入待放行队列。',
        at: '今日申时',
        owner: '销售庄园',
        state: 'assigned',
      },
      {
        id: 'sales-2',
        title: '蜂群执行',
        detail: '销售蜂群将按高意图、低承诺风险优先推进。',
        at: '今日酉时',
        owner: '成交蜂群',
        state: 'running',
      },
      {
        id: 'sales-3',
        title: '统一回写',
        detail: '结果统一回写史馆，并同步给丞相台和户部。',
        at: '今夜',
        owner: '史官 / 户部',
        state: 'summarizing',
      },
    ],
    workbench: [
      {
        lane: '高意图快车',
        owner: '成交蜂群',
        state: 'running',
        detail: '优先推进高分商机，控制承诺口径并同步回款预期。',
      },
      {
        lane: '风险复核',
        owner: '刑部侧写蜂群',
        state: 'waiting_dependency',
        detail: '补齐边界后自动放行，未补齐前不允许过度承诺。',
      },
      {
        lane: '经营回写',
        owner: '史官 / 户部',
        state: 'assigned',
        detail: '统一回写队列状态、预计回款与需要升级的线索。',
      },
    ],
    writebackSummary: [
      {
        title: '快车队列',
        value: '12 条',
        note: '高意图线索已进入快车承接，待最终边界放行。',
      },
      {
        title: '预计回款',
        value: '¥ 380k',
        note: '仅统计已通过边界校验的高置信度商机。',
      },
      {
        title: '升级事项',
        value: '2 项',
        note: '需要刑部补充边界与礼部统一口径后再扩量。',
      },
    ],
    actionBoard: {
      today: [
        '完成快车队列线索复核并锁定优先级。',
        '同步礼部统一承诺口径到一线话术。',
        '晚间回写预计回款与升级事项。',
      ],
      blockers: [
        '刑部边界仍有 2 项待补说明。',
        '部分线索缺失完整成交条件确认。',
      ],
      escalations: [
        '若边界补充继续延迟，需回丞相台重定放量节奏。',
      ],
    },
  },
  {
    domain: 'marketing',
    title: '网站营销庄园',
    summary: '把官网流量、内容承接和落地页动作转成高意图线索。',
    cooperation: '常联动礼部、工部',
    queueState: '官网实验已获批，等待新的 landing 结构和内容策略同步上线。',
    objective: '减少低质量内容耗损，把资源集中到高意图线索承接链。',
    writeback: '按日回写实验命中率、表单质量、内容完成度与下一步建议。',
    traceId: 'trace-marketing-2113',
    linkedCaseId: 'GV-2113',
    linkedArtifacts: [
      { label: '落地页重排草图', kind: '蜂群纪要', href: '/reports' },
      { label: '营销回写摘要', kind: '回写', href: '/scribe' },
    ],
    timeline: [
      {
        id: 'marketing-1',
        title: '资源重排',
        detail: '礼部与工部会签后的实验优先级已经下达到庄园。',
        at: '午后',
        owner: '营销庄园',
        state: 'running',
      },
      {
        id: 'marketing-2',
        title: '内容与页面联调',
        detail: '内容蜂群与页面蜂群开始同步收敛入口与表单。',
        at: '今日申时',
        owner: '内容蜂群 / 页面蜂群',
        state: 'running',
      },
      {
        id: 'marketing-3',
        title: '阶段回写',
        detail: '阶段结果同步回史馆，供 NotebookLM 做专题综合。',
        at: '今日戌时',
        owner: '史官',
        state: 'assigned',
      },
    ],
    workbench: [
      {
        lane: '入口收口',
        owner: '页面蜂群',
        state: 'running',
        detail: '重排首页和落地页入口，把高意图 CTA 放到最短路径。',
      },
      {
        lane: '内容定调',
        owner: '礼部文案蜂群',
        state: 'running',
        detail: '统一口径，压掉过度承诺和低价值叙事。',
      },
      {
        lane: '结果回写',
        owner: '史官 / NotebookLM',
        state: 'assigned',
        detail: '沉淀实验结果、提炼模板并形成专题知识包。',
      },
    ],
    writebackSummary: [
      {
        title: '落地页重排',
        value: '3 组',
        note: '主入口、案例页、表单页已进入联调。',
      },
      {
        title: '高意图表单',
        value: '+18%',
        note: '相较上一版，表单质量和完成度同步提升。',
      },
      {
        title: '知识沉淀',
        value: '1 包',
        note: '已生成专题 source pack，待 NotebookLM 综合。',
      },
    ],
    actionBoard: {
      today: [
        '完成主入口与案例页高意图 CTA 收口。',
        '联调表单路径与内容结构。',
        '把首批结果沉淀为专题 source pack。',
      ],
      blockers: [
        '部分页面文案仍需礼部最终定调。',
        '落地页联调节奏受工部资源影响。',
      ],
      escalations: [
        '若表单质量持续不升，需回治理流重审资源优先级。',
      ],
    },
  },
  {
    domain: 'ecommerce',
    title: '电商庄园',
    summary: '把跨境站点、渠道与经营动作转成增长与现金流。',
    cooperation: '常联动户部、工部、礼部',
    queueState: '跨境试验待门下复核完成后正式开跑。',
    objective: '把跨境机会先作为受控试验推进，验证渠道、口径和回款闭环。',
    writeback: '统一回写站点表现、渠道命中、合规提示和现金流预测。',
    traceId: 'trace-ecommerce-2109',
    linkedCaseId: 'GV-2109',
    linkedArtifacts: [
      { label: '跨境渠道观察板', kind: '蜂群纪要', href: '/intel' },
      { label: '电商试验回写', kind: '回写', href: '/scribe' },
    ],
    timeline: [
      {
        id: 'ecommerce-1',
        title: '试验待发',
        detail: '门下省完成复核后，尚书省将正式向电商庄园派发。',
        at: '明日辰时',
        owner: '尚书省',
        state: 'waiting_dependency',
      },
      {
        id: 'ecommerce-2',
        title: '渠道试探',
        detail: '试验蜂群先跑小样，避免全量投入。',
        at: '明日午时',
        owner: '跨境蜂群',
        state: 'assigned',
      },
      {
        id: 'ecommerce-3',
        title: '经营回写',
        detail: '结果按 trace 链回写到史馆和丞相台。',
        at: '明日酉时',
        owner: '史官 / 丞相台',
        state: 'assigned',
      },
    ],
    workbench: [
      {
        lane: '跨境试探',
        owner: '跨境蜂群',
        state: 'assigned',
        detail: '按受控样本试跑，不做全量推进。',
      },
      {
        lane: '渠道与口径',
        owner: '礼部 / 工部联合蜂群',
        state: 'waiting_dependency',
        detail: '等待门下复核完成后统一放量。',
      },
      {
        lane: '现金流回写',
        owner: '户部 / 史官',
        state: 'assigned',
        detail: '把渠道表现和现金流预测统一回写给朝堂。',
      },
    ],
    writebackSummary: [
      {
        title: '受控试验',
        value: '2 条',
        note: '跨境渠道只放小样本，不做全量投放。',
      },
      {
        title: '口径统一',
        value: '待复核',
        note: '礼部与刑部复核完成后才会正式放量。',
      },
      {
        title: '现金流预测',
        value: '¥ 120k',
        note: '按当前样本估算，仍需观察稳定性。',
      },
    ],
    actionBoard: {
      today: [
        '完成跨境小样本试跑名单确认。',
        '对齐礼部与刑部的统一口径。',
        '准备第一轮渠道与现金流回写模板。',
      ],
      blockers: [
        '门下复核尚未最终通过。',
        '跨境渠道样本仍不足以支持放量。',
      ],
      escalations: [
        '如复核被驳回，需回丞相台重新定义试验边界。',
      ],
    },
  },
];

export function getGovernanceCase(caseId: string) {
  return GOVERNANCE_CASES.find((item) => item.id === caseId) ?? null;
}

export function getManorExecution(domain: string) {
  return MANOR_EXECUTIONS.find((item) => item.domain === domain) ?? null;
}
