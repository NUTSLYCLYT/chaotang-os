/**
 * 任务生命周期状态 —— 冻结，不可随意增删
 */
export enum TaskStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Interpreting = 'interpreting',
  Planning = 'planning',
  Assigned = 'assigned',
  Running = 'running',
  Aggregating = 'aggregating',
  ReportReady = 'report_ready',
  Reviewed = 'reviewed',
  Archived = 'archived',
}

/**
 * 部门代号 —— 六部 + 钦天监 + 锦衣卫
 */
export enum Department {
  /** 吏部：组织、人力、招聘、绩效 */
  Personnel = 'li_bu',
  /** 户部：金融投资、股票分析、估值、资产配置 */
  Revenue = 'hu_bu',
  /** 礼部：品牌、营销、短视频、海外电商 */
  Rites = 'li_bu_rites',
  /** 兵部：竞品、战略、攻防、市场情报 */
  Military = 'bing_bu',
  /** 刑部：制度、行政、风控、KPI/OKR */
  Justice = 'xing_bu',
  /** 工部：产品、技术、工程、实施交付 */
  Works = 'gong_bu',
  /** 钦天监：趋势预测、概率推演、风险窗口 */
  Observatory = 'qin_tian_jian',
  /** 锦衣卫：全球情报、舆情扫描、信号监测 */
  Guard = 'jin_yi_wei',
}

/**
 * 执行模式
 */
export enum ExecutionMode {
  /** 全脚本驱动，不调用 LLM */
  Scripted = 'scripted',
  /** 规则 + LLM 混合 */
  Hybrid = 'hybrid',
  /** 全 LLM 实时 */
  Live = 'live',
}

/**
 * 事件类型
 */
export enum EventType {
  TaskCreated = 'task_created',
  IntentDetected = 'intent_detected',
  SubtaskAssigned = 'subtask_assigned',
  DepartmentRunning = 'department_running',
  IntermediateResultReady = 'intermediate_result_ready',
  RiskAlert = 'risk_alert',
  ReportReady = 'report_ready',
  ImperialReviewSubmitted = 'imperial_review_submitted',
  MemoryWritten = 'memory_written',
}
