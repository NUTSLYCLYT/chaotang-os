/**
 * 史馆 · 类型定义
 */

export type CaseOutcome = 'success' | 'blocked' | 'failed' | 'pending'

export interface ArchiveItem {
  id: string
  title: string
  type: string
  outcome: CaseOutcome
  department: string
  date: string
  reportId?: string
  isGovernance?: boolean
}

export interface CommandTypeFreq {
  type: string
  count: number
  pct: number
}

export interface DeptSuccessRate {
  dept: string
  total: number
  success: number
  rate: number
}

export interface ShiguanStats {
  totalTasks: number
  totalCases: number
  successRate: number
}
