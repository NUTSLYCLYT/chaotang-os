/**
 * Agent ID → 用户看到的中文称呼 + emoji
 *
 * 历史语义校准: flow_court yaml 里 taizi_intake / taizi_output 在头尾两端,
 * 但"陛下"+"太子" 历史不通 (太子是储君, 不参政)。前端展示统一映射成"丞相",
 * 维持"陛下身边丞相辅政"的小白心智。后端 agent_id 不动 (避免改 yaml).
 *
 * 当 FlowCanvas / SSE 节点 / 复盘卡渲染 agent 时, 一律走此 mapping.
 */

export interface AgentDisplay {
  /** 用户看到的中文称呼 */
  label: string;
  /** emoji 角色徽 */
  emoji: string;
  /** 一句话职能描述 (hover/tooltip 用) */
  role: string;
  /** 所属"省/部" 大类 (用于分组着色) */
  bureau: 'liaison' | 'drafting' | 'review' | 'dispatch' | 'execution' | 'analysis' | 'qa';
}

/**
 * flow_court 三省六部 9 agent 映射
 * (agent_id 是 Fengqun yaml 里的 step.id, 不动后端)
 */
const COURT_FLOW: Record<string, AgentDisplay> = {
  taizi_intake: {
    label: '丞相 · 接旨',
    emoji: '👑',
    role: '接收陛下诏令, 战略研判, 拆解到三省',
    bureau: 'liaison',
  },
  zhongshu_analyze: {
    label: '中书省 · 起草',
    emoji: '📜',
    role: '中书令拟方案, 把诏令变成可执行任务树',
    bureau: 'drafting',
  },
  menxia_review: {
    label: '门下省 · 审议',
    emoji: '🛡️',
    role: '门下侍中审核, 准奏 / 封驳 / 询问 / 修订',
    bureau: 'review',
  },
  shangshu_dispatch: {
    label: '尚书省 · 派单',
    emoji: '🏛️',
    role: '尚书令按部门派发任务到六部',
    bureau: 'dispatch',
  },
  liubu_execute: {
    label: '六部 · 执行',
    emoji: '⚙️',
    role: '工部 / 户部 / 礼部 / 刑部 / 兵部各司其职',
    bureau: 'execution',
  },
  zhuangyuan_analyze: {
    label: '庄园 · 专项',
    emoji: '🏡',
    role: '法律庄园 + 财务庄园等行业能力层介入',
    bureau: 'analysis',
  },
  shangshu_aggregate: {
    label: '尚书省 · 汇总',
    emoji: '🏛️',
    role: '收集六部执行结果, 整合成报告',
    bureau: 'dispatch',
  },
  zhongshu_conclude: {
    label: '中书省 · 复核',
    emoji: '📜',
    role: '中书复核最终结论, 文采润色',
    bureau: 'drafting',
  },
  taizi_output: {
    label: '丞相 · 复命',
    emoji: '👑',
    role: '丞相收口, 把朝廷决议回传给陛下',
    bureau: 'liaison',
  },
};

/**
 * 跨蜂群通用 agent (qa_tech_support 等)
 */
const COMMON_AGENTS: Record<string, AgentDisplay> = {
  qa_tech_support: { label: '御史 · 巡查', emoji: '🔍', role: '六维度质量评估, 找漏补缺', bureau: 'qa' },
  qa_check: { label: '御史 · 验收', emoji: '🔍', role: '把分析师输出包成结构化 final_output', bureau: 'qa' },
  prompt_optimizer: { label: '翰林 · 草拟', emoji: '✒️', role: '优化 prompt, 让说话更精准', bureau: 'drafting' },
  remonstrance_critic: { label: '御史台 · 红队', emoji: '⚔️', role: '弹劾, 找产出里的漏洞', bureau: 'review' },
};

/**
 * OPC 市场方案流程 (5 agent)
 */
const OPC_AGENTS: Record<string, AgentDisplay> = {
  opc_leader: { label: 'OPC 负责人', emoji: '🎯', role: '任务分解, 目标定义', bureau: 'liaison' },
  market_intel: { label: '市场情报专员', emoji: '🌐', role: '市场与竞品情报分析', bureau: 'analysis' },
  solution_architect: { label: '解决方案架构师', emoji: '🏗️', role: '技术方案设计', bureau: 'drafting' },
  customer_success: { label: '客户成功经理', emoji: '🤝', role: '客户价值表达转化', bureau: 'execution' },
};

/**
 * 产品规划 (5 agent)
 */
const PRODUCT_AGENTS: Record<string, AgentDisplay> = {
  product_manager: { label: '产品部门经理', emoji: '📋', role: '战略研判与工作指令下达', bureau: 'liaison' },
  competitive_research: { label: '竞品研究专员', emoji: '🔭', role: '竞品分析与市场洞察', bureau: 'analysis' },
  product_planning: { label: '产品规划专员', emoji: '📐', role: 'PRD 编写与产品落地规划', bureau: 'drafting' },
  compliance_check: { label: '合规评估专员', emoji: '⚖️', role: '合规风险评估与认证规划', bureau: 'review' },
};

/**
 * 郝龙获客 Pipeline (5 agent)
 */
const HAOLONG_AGENTS: Record<string, AgentDisplay> = {
  lead_acquisition: { label: '获客 AI', emoji: '🎣', role: '商机识别与线索评分', bureau: 'analysis' },
  lead_archive: { label: '归档 AI', emoji: '📁', role: '客户档案构建与去重', bureau: 'drafting' },
  lead_outreach: { label: '触达 AI', emoji: '📨', role: '触达策略与沟通话术', bureau: 'execution' },
  content_publish: { label: '发布 AI', emoji: '📢', role: '营销内容生成与分发策略', bureau: 'execution' },
};

/**
 * 评估 / 信息查询直答 (上书房私聊 主力 flow, 984 次跑过)
 */
const EVALUATE_AGENTS: Record<string, AgentDisplay> = {
  evaluate_analyst: { label: '上书房 · 应对', emoji: '📚', role: '陛下私召, 直答或带证据回答', bureau: 'liaison' },
};

/**
 * 综合所有蜂群的 agent 映射
 */
const ALL_AGENTS: Record<string, AgentDisplay> = {
  ...COURT_FLOW,
  ...COMMON_AGENTS,
  ...OPC_AGENTS,
  ...PRODUCT_AGENTS,
  ...HAOLONG_AGENTS,
  ...EVALUATE_AGENTS,
};

/**
 * 主 API: 拿 agent_id 给中文称呼。未知 id 返回原 id 兜底.
 */
export function agentDisplay(agentId: string): AgentDisplay {
  return (
    ALL_AGENTS[agentId] ?? {
      label: agentId,
      emoji: '👤',
      role: '未注册角色',
      bureau: 'execution',
    }
  );
}

/**
 * Bureau (省/部) → 主题色, 用于 FlowCanvas 节点边框 / status badge
 */
export const BUREAU_COLOR: Record<AgentDisplay['bureau'], string> = {
  liaison: '#F0C66A',   // 帝金 - 丞相/枢纽
  drafting: '#6BA0FF',  // 蓝 - 中书/翰林起草
  review: '#F43F5E',    // 红 - 门下/御史审议
  dispatch: '#3DD68C',  // 绿 - 尚书派发
  execution: '#9AA3C4', // 银 - 六部执行
  analysis: '#A78BFA',  // 紫 - 庄园/情报分析
  qa: '#F5A524',        // 橙 - 御史巡查
};
