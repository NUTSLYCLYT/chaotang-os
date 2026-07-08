import type { TaskIntent, DeptCode } from './types'

/**
 * 从用户输入检测意图和部门
 * 不使用 LLM，纯关键词匹配 + 正则
 */

const INTENT_KEYWORDS: Record<TaskIntent, string[]> = {
  analysis: [
    '分析', 'analyze', '统计', 'summary', '总结', 'overview',
    '数据', 'data', '查看', 'view', '查询', 'query'
  ],
  forecast: [
    '预测', 'forecast', '规划', 'plan', '展望', 'outlook',
    '趋势', 'trend', '预期', 'expect', '走势'
  ],
  risk: [
    '风险', 'risk', '问题', 'problem', '诊断', 'diagnose',
    '隐患', '评估', 'assess', '缺陷', 'defect',
    '挑战', 'challenge'
  ],
  optimize: [
    '优化', 'optimize', '改进', 'improve', '成本', 'cost',
    '效率', 'efficiency', '降低', 'reduce', '提升', 'boost'
  ],
  report: [
    '日报', 'daily', '周报', 'weekly', '月报', 'monthly',
    '报告', 'report', '总结', 'summary', '汇报', 'brief'
  ],
  decision: [
    '决策', 'decision', '选型', 'selection', '对标', 'benchmark',
    '方案', 'proposal', '对比', 'compare', '抉择'
  ],
  other: ['其他', 'other']
}

const DEPT_KEYWORDS: Record<DeptCode, string[]> = {
  hu_bu: ['户部', '财务', 'finance', '财', '金融', '预算', 'budget'],
  li_bu: ['吏部', '人事', 'hr', '人力', 'talent', '组织', 'organization'],
  bing_bu: ['兵部', '战略', 'strategy', '竞争', 'competition', '市场', 'market'],
  xing_bu: ['刑部', '合规', 'compliance', '风控', 'risk', '法律', 'legal'],
  gong_bu: ['工部', '技术', 'tech', '工程', 'engineering', '开发', 'development'],
  li_bu_dept: ['礼部', '品牌', 'brand', '营销', 'marketing', '传播'],
  jinyiwei: ['锦衣卫', '情报', 'intel', '竞情', '市场调研'],
  qintian: ['钦天监', '趋势', 'trend', '预言', '洞察', 'insight'],
  taiyi: ['太医院', '健康', 'health', '诊断', 'diagnosis', '状态']
}

export function detectIntent(input: string): TaskIntent {
  const lower = input.toLowerCase()

  // 关键词匹配，优先级从高到低
  for (const intent of ['risk', 'decision', 'optimize', 'forecast', 'analysis', 'report'] as TaskIntent[]) {
    const keywords = INTENT_KEYWORDS[intent]
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return intent
    }
  }

  return 'other'
}

export function detectDept(input: string): DeptCode | null {
  const lower = input.toLowerCase()

  // 扫描所有部门关键词
  for (const [dept, keywords] of Object.entries(DEPT_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return dept as DeptCode
    }
  }

  return null
}

export function extractUserIntent(input: string) {
  return {
    intent: detectIntent(input),
    dept: detectDept(input),
    raw: input
  }
}
