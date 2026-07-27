/**
 * 上书房（Shangshufang）· 类型定义
 * 对应 Figma「01-shangshufang」电影感三栏：丞相 · 奏折 · 钦天监。
 */

/** 优先级（朱印徽章）：急 / 高 / 中 / 低 */
export type Priority = 'urgent' | 'high' | 'medium' | 'low';

/** 状态标签 */
export type ImperialStatus = 'pending' | 'running' | 'completed' | 'risk' | 'archived';

/** 左栏 · 丞相建议条目 */
export interface ChancellorSuggestion {
  id: string;
  title: string;
  /** 干支落款 / 标记，如「甲申 · 急报」 */
  tag: string;
  priority: Priority;
  /** 经营闭环建议：点击后可直接预填为圣旨 */
  suggestedCommand?: string;
  /** 后端蜂群执行完成后的 final_output 摘要，用于奏折“建议”正文 */
  swarmOutput?: string;
  /** 为什么今天要处理 */
  whyNow?: string;
  /** 建议来源，如「来源 · 户部预算」 */
  sourceLabel?: string;
  /** 可核验证据，来自预算、史馆复盘、任务池等结构化数据 */
  evidence?: string[];
  /** 推荐参审大臣 */
  recommendedMinisters?: string[];
  /** 贯穿拟旨、会审、裁决、归档的排障追踪 ID */
  loopTraceId?: string;
  /** 若此建议来自一封真实奏折，保留同一个展示对象用于点击后精确回显 */
  memorial?: Memorial;
}

/** 中央 · 奏折（御前奏报）· 单封 */
export interface Memorial {
  id: string;
  title: string;
  subtitle: string;
  /** 首屏焦点提示，如「今日一号奏折」 */
  focusLabel?: string;
  /** 数据可信边界：真实、有缺口、兜底或演示 */
  sourceMode?: 'LIVE' | 'MIXED' | 'FALLBACK' | 'DEMO';
  /** 数据来源说明，如「本地兜底奏折」 */
  sourceLabel?: string;
  /** 可核验证据条数 */
  evidenceCount?: number;
  /** 后端 contract_scope 对该任务的显式分类。 */
  contractTask?: boolean;
  /** 提折人，如「江南巡抚 田丰」 */
  petitioner: string;
  /** 奏闻人，如「兵部尚书 白浚」 */
  reporter: string;
  priority: Priority;
  reason: string;
  suggestion: string;
  risk: string;
  verdict: string;
  closing: string;
  /** 落款时辰，如「甲申三刻」 */
  sealDate: string;
  /** 裁决可选项（供「立即裁决」弹窗） */
  decisionOptions: string[];
  /** 贯穿拟旨、会审、裁决、归档的排障追踪 ID */
  loopTraceId?: string;
}

/** 右栏 · 钦天监教学条目 */
export interface WangTutorial {
  id: string;
  title: string;
  subtitle: string;
  duration?: string;
}

/** 顶部导航项 */
export interface NavItem {
  key: string;
  label: string;
  /** 概念路由（demo 不实际跳转，点击给提示） */
  href: string;
}

/** 下旨模式：问丞相 / 发布圣旨 / 密旨（均先预览，确认后执行） */
export type DecreeMode = 'ask' | 'order' | 'secret';

/** 下旨提交后的反馈态 */
export type DecreeState = 'idle' | 'consulting' | 'submitted' | 'error';
