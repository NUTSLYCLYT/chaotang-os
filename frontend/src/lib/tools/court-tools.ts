/**
 * 朝堂 OS · Court Tool Definitions
 *
 * 严格遵循 Anthropic tool_use 格式：
 *   { name, description, input_schema: { type, properties, required } }
 *
 * OpenAI 侧在 executor 做格式转换，不在此处冗余定义。
 */

export interface AnthropicToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: { type: string };
  }>;
  required?: string[];
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: AnthropicToolInputSchema;
}

/** 查询任务状态 */
export const getTaskStatus: AnthropicTool = {
  name: 'get_task_status',
  description:
    '查询朝堂任务的当前状态、负责大臣和进度摘要。用于获取某个 taskId 的实时状态快照。',
  input_schema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: '任务 ID，格式为 UUID 字符串',
      },
    },
    required: ['task_id'],
  },
};

/** 派发新任务到蜂群 */
export const dispatchSwarmTask: AnthropicTool = {
  name: 'dispatch_swarm_task',
  description:
    '向指定蜂群单元派发一个新任务，指定执行者大臣代码和优先级。返回新建任务的 ID。',
  input_schema: {
    type: 'object',
    properties: {
      swarm_unit: {
        type: 'string',
        description: '目标蜂群单元标识，如 "jiqun-alpha"',
      },
      agent_code: {
        type: 'string',
        description:
          '负责执行的大臣代码，11 个合法值之一：ZS / LB / BY / ZGL / ZH / WH / XC / HZ / BG / JW / YQ',
        enum: ['ZS', 'LB', 'BY', 'ZGL', 'ZH', 'WH', 'XC', 'HZ', 'BG', 'JW', 'YQ'],
      },
      instruction: {
        type: 'string',
        description: '任务指令正文，自然语言描述目标',
      },
      priority: {
        type: 'string',
        description: '优先级，low / normal / high / critical',
        enum: ['low', 'normal', 'high', 'critical'],
      },
    },
    required: ['swarm_unit', 'agent_code', 'instruction'],
  },
};

/** 搜索历史奏折（史馆） */
export const searchArchive: AnthropicTool = {
  name: 'search_archive',
  description:
    '在史馆归档中全文搜索历史任务报告和奏折，支持关键词和时间范围过滤。返回匹配的报告列表。',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词，支持中英文',
      },
      date_from: {
        type: 'string',
        description: '起始日期，ISO 8601 格式（如 2024-01-01），可选',
      },
      date_to: {
        type: 'string',
        description: '截止日期，ISO 8601 格式（如 2024-12-31），可选',
      },
      limit: {
        type: 'string',
        description: '最多返回条数，字符串数字，默认 "10"，上限 "50"',
      },
    },
    required: ['query'],
  },
};

/** 获取大臣当前负载 */
export const getAgentLoad: AnthropicTool = {
  name: 'get_agent_load',
  description:
    '获取指定大臣当前的任务负载情况，包括运行中任务数、队列长度和健康状态，用于决策是否增派或转移任务。',
  input_schema: {
    type: 'object',
    properties: {
      agent_code: {
        type: 'string',
        description:
          '大臣代码，11 个合法值之一：ZS / LB / BY / ZGL / ZH / WH / XC / HZ / BG / JW / YQ',
        enum: ['ZS', 'LB', 'BY', 'ZGL', 'ZH', 'WH', 'XC', 'HZ', 'BG', 'JW', 'YQ'],
      },
    },
    required: ['agent_code'],
  },
};

/** 创建六部执行任务（尚书省落地用） */
export const createMinistryTask: AnthropicTool = {
  name: 'create_ministry_task',
  description:
    '尚书省落地工具：把一项已准奏的政令拆成一条可执行任务，分派给指定六部/专署大臣。' +
    '每调用一次新建一个 step（可多次调用以拆成 DAG）。返回新建 step 的 id。',
  input_schema: {
    type: 'object',
    properties: {
      dept: {
        type: 'string',
        description:
          '负责执行的大臣代码，11 个合法值之一：ZS / LB / BY / ZGL / ZH / WH / XC / HZ / BG / JW / YQ',
        enum: ['ZS', 'LB', 'BY', 'ZGL', 'ZH', 'WH', 'XC', 'HZ', 'BG', 'JW', 'YQ'],
      },
      action: {
        type: 'string',
        description: '该步骤的具体动作描述（自然语言，须 < 30 分钟可完成）',
      },
      depends_on: {
        type: 'array',
        description: '依赖的前置 step id 列表，可为空数组（首步）',
        items: { type: 'string' },
      },
      blast_radius: {
        type: 'string',
        description: '失败影响面：low / medium / high',
        enum: ['low', 'medium', 'high'],
      },
    },
    required: ['dept', 'action'],
  },
};

/** 获取锦衣卫当前情报信号（Turso 查询） */
export const getIntelSignals: AnthropicTool = {
  name: 'get_intel_signals',
  description:
    '查询锦衣卫当前情报信号列表，支持按类别、等级、地区过滤。返回信号标题、摘要、等级、地区和可信度。' +
    '用于回答"当前有哪些风险"、"哪条情报最危急"等问题。',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: '情报类别过滤：risk（风险）/ opportunity（机会）/ neutral（中性）。不填返回全部。',
        enum: ['risk', 'opportunity', 'neutral'],
      },
      level: {
        type: 'string',
        description: '情报等级过滤：critical / warning / watch / info。不填返回全部。',
        enum: ['critical', 'warning', 'watch', 'info'],
      },
      region: {
        type: 'string',
        description: '地区代码过滤，如 "EU"、"US"、"CN"。不填返回全部。',
      },
      limit: {
        type: 'string',
        description: '最多返回条数，字符串数字，默认 "10"，上限 "50"',
      },
    },
    required: [],
  },
};

/**
 * 查询健康档案（太医院专属工具）
 *
 * 允许 LLM 在 /api/orchestration/run 流水线中读取
 * Turso health_profiles 表快照，返回带 citations 的结构化健康摘要。
 */
export const queryHealthProfile: AnthropicTool = {
  name: 'query_health_profile',
  description:
    '读取太医院健康档案，返回总分、风险等级、关键指标和干预计划。' +
    '用于回答陛下关于龙体健康的问询，回答必须附带引用来源（citations）。' +
    'aspect 可选 overview/metrics/alerts/interventions/news；' +
    'metric_codes 可选择具体指标代码过滤（如 ["LDL","BP_S"]）。',
  input_schema: {
    type: 'object',
    properties: {
      aspect: {
        type: 'string',
        description: '查询维度：overview（全览）/ metrics（指标）/ alerts（预警）/ interventions（干预）/ news（医讯）',
        enum: ['overview', 'metrics', 'alerts', 'interventions', 'news'],
      },
      metric_codes: {
        type: 'array',
        description: '可选：指标代码过滤，如 ["LDL", "BP_S"]',
        items: { type: 'string' },
      },
    },
    required: ['aspect'],
  },
};

/** 查询户部财政概览（真实 Turso 数据） */
export const getFinanceMetrics: AnthropicTool = {
  name: 'get_finance_metrics',
  description:
    '查询户部（Revenue Ministry）当前财政状况：预算总额、待批项目数、平均 ROI、现金余量及建议摘要。' +
    '引用来自 Turso 实时数据库，返回字段含 source（"turso" | "fallback"）标注数据鲜度。' +
    '回答须附带引用（citations）指向具体项目 id。',
  input_schema: {
    type: 'object',
    properties: {
      include_projects: {
        type: 'string',
        description: '"true" 则同时返回项目台账列表，"false"（默认）只返回摘要',
        enum: ['true', 'false'],
      },
      status_filter: {
        type: 'string',
        description: '按状态过滤项目：pending_review / approved / needs_rework。不填返回全部。',
        enum: ['pending_review', 'approved', 'needs_rework'],
      },
    },
  },
};

/** 查询庄园六部实时指标（Turso manor_metrics 表），返回带引用来源的结构化数据 */
export const queryManorData: AnthropicTool = {
  name: 'query_manor_data',
  description:
    '查询庄园六部（吏/户/礼/兵/刑/工）的实时经营指标。' +
    '返回结构化指标列表，每条指标附带数据来源引用（citation），用于支持有据可查的决策建议。' +
    '适用于：经营状况分析、风险预警、六部协同建议、定期巡检报告。',
  input_schema: {
    type: 'object',
    properties: {
      ministry_keys: {
        type: 'array',
        description:
          '需要查询的部门 key 列表，可选值：libu / hubu / libu2 / bingbu / xingbu / gongbu。' +
          '留空（空数组）代表查询全部六部。',
        items: { type: 'string' },
      },
      include_citations: {
        type: 'string',
        description: '是否在返回中附带数据来源引用，"true" 或 "false"，默认 "true"',
        enum: ['true', 'false'],
      },
    },
    required: [],
  },
};

/** 全部工具集合（Anthropic 格式，可直接传给 messages API） */
export const COURT_TOOLS: AnthropicTool[] = [
  getTaskStatus,
  dispatchSwarmTask,
  searchArchive,
  getAgentLoad,
  createMinistryTask,
  getIntelSignals,
  queryHealthProfile,
  getFinanceMetrics,
  queryManorData,
];

/** 锦衣卫专属工具集（含情报查询） */
export const JINYIWEI_TOOLS: AnthropicTool[] = [
  getIntelSignals,
  dispatchSwarmTask,
  getAgentLoad,
  searchArchive,
];

/** 太医院专属工具集 */
export const TAIYI_TOOLS: AnthropicTool[] = [
  queryHealthProfile,
  searchArchive,
  getAgentLoad,
];

/** 户部专属工具集（财政 + 通用） */
export const HUBU_TOOLS: AnthropicTool[] = [
  getFinanceMetrics,
  createMinistryTask,
  searchArchive,
  getAgentLoad,
];
