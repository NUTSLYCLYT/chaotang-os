/**
 * 下旨推荐系统类型定义
 */

export type TaskIntent =
  | 'analysis'      // 分析、统计、总结
  | 'forecast'      // 预测、规划、展望
  | 'risk'          // 风险评估、问题诊断
  | 'optimize'      // 优化、改进、成本控制
  | 'report'        // 日报、周报、月报
  | 'decision'      // 决策、选型、方案对标
  | 'other'

export type DeptCode =
  | 'hu_bu'         // 户部（财务）
  | 'li_bu'         // 吏部（人事）
  | 'bing_bu'       // 兵部（战略）
  | 'xing_bu'       // 刑部（合规）
  | 'gong_bu'       // 工部（技术）
  | 'li_bu_dept'    // 礼部（品牌）
  | 'jinyiwei'      // 锦衣卫（情报）
  | 'qintian'       // 钦天监（趋势）
  | 'taiyi'         // 太医院（健康）

export interface PromptSuggestion {
  // 用户原始意图
  userInput: string
  intent: TaskIntent
  dept: DeptCode | null

  // 三个方案
  suggestions: {
    fast: SuggestionOption      // 3s, 便宜
    standard: SuggestionOption  // 15s, 中等
    deep: SuggestionOption      // 60s, 贵
  }

  // 推荐方案
  recommended: 'fast' | 'standard' | 'deep'
  recommendedReason: string

  // 智能分拆建议
  canSplit: boolean
  splitSuggestion?: {
    description: string
    subTasks: string[]
  }

  // 用户历史数据
  userHistory: {
    totalAttempts: number
    successRate: {
      fast: number
      standard: number
      deep: number
    }
    lastUsedMode: 'fast' | 'standard' | 'deep' | null
  }

  // 注:原 systemState（队列/负载/成本 HUD）已删。
  // 大神会审(Bezos)裁定：那是 Math.random + 硬编码 USD 的 "value theater"——
  // 给老板看假的"AI 帮你省了 $X"，他一旦核对发现是假，会一次性失信于系统所有数字。
  // 真实队列/成本遥测接通前，绝不在此伪造。要恢复请接真实数据源，勿再填随机数。
}

export interface SuggestionOption {
  mode: 'fast' | 'standard' | 'deep'
  prompt: string              // 润色后的下旨
  estimatedTime: number       // 毫秒
  estimatedCost: number       // USD
  description: string         // 人类可读的说明
}

export interface UserHistoryStats {
  userId: string
  intent: TaskIntent
  dept: DeptCode
  totalAttempts: number
  successCount: {
    fast: number
    standard: number
    deep: number
  }
  avgCompletionTime: {
    fast: number
    standard: number
    deep: number
  }
  lastAttempt: string | null
}
