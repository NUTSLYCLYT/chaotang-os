/**
 * 史馆 · Mock 数据
 *
 * 未来接真 API 时，此文件可被 replace 为 fetch 调用。
 */

import type { ArchiveItem, CommandTypeFreq, DeptSuccessRate } from './shiguan-types'

export const MOCK_ARCHIVE: ArchiveItem[] = [
  {
    id: 'GOV-001',
    title: 'Q1 销售战略优化议题',
    type: '治理议题',
    outcome: 'success',
    department: '销售庄园',
    date: '2026-04-18T10:30:00Z',
    reportId: 'task-001',
    isGovernance: true,
  },
  {
    id: 'TASK-089',
    title: '欧洲市场扩张可行性分析',
    type: '蜂群任务',
    outcome: 'success',
    department: '战略司',
    date: '2026-04-16T14:20:00Z',
    reportId: 'task-089',
  },
  {
    id: 'GOV-002',
    title: '竞品应对策略议题',
    type: '治理议题',
    outcome: 'blocked',
    department: '门下省',
    date: '2026-04-15T09:00:00Z',
    isGovernance: true,
  },
  {
    id: 'TASK-076',
    title: 'AI 团队技术债务清理计划',
    type: '蜂群任务',
    outcome: 'success',
    department: '技术司',
    date: '2026-04-14T16:45:00Z',
    reportId: 'task-076',
  },
  {
    id: 'TASK-068',
    title: '年度财务预算审核',
    type: '蜂群任务',
    outcome: 'failed',
    department: '财务司',
    date: '2026-04-12T11:00:00Z',
  },
  {
    id: 'GOV-003',
    title: '供应链风险管控制度',
    type: '治理议题',
    outcome: 'success',
    department: '尚书省',
    date: '2026-04-10T08:30:00Z',
    reportId: 'task-058',
    isGovernance: true,
  },
  {
    id: 'TASK-055',
    title: '客户服务体验优化项目',
    type: '蜂群任务',
    outcome: 'success',
    department: '运营司',
    date: '2026-04-08T13:15:00Z',
    reportId: 'task-055',
  },
  {
    id: 'GOV-004',
    title: '人才激励机制改革方案',
    type: '治理议题',
    outcome: 'success',
    department: '人事司',
    date: '2026-04-05T10:00:00Z',
    reportId: 'task-043',
    isGovernance: true,
  },
  {
    id: 'TASK-040',
    title: '法律合规体系审查',
    type: '蜂群任务',
    outcome: 'success',
    department: '法务司',
    date: '2026-04-02T09:30:00Z',
    reportId: 'task-040',
  },
  {
    id: 'TASK-031',
    title: '品牌传播策略规划',
    type: '蜂群任务',
    outcome: 'pending',
    department: '公关司',
    date: '2026-03-28T14:00:00Z',
  },
]

export const COMMAND_TYPES: CommandTypeFreq[] = [
  { type: '战略分析', count: 12, pct: 34 },
  { type: '治理议题', count: 9, pct: 26 },
  { type: '风险管控', count: 6, pct: 17 },
  { type: '财务审查', count: 5, pct: 14 },
  { type: '人才管理', count: 3, pct: 9 },
]

export const DEPT_SUCCESS: DeptSuccessRate[] = [
  { dept: '战略司', total: 8, success: 8, rate: 100 },
  { dept: '法务司', total: 5, success: 5, rate: 100 },
  { dept: '运营司', total: 7, success: 6, rate: 86 },
  { dept: '技术司', total: 6, success: 5, rate: 83 },
  { dept: '财务司', total: 4, success: 3, rate: 75 },
  { dept: '公关司', total: 3, success: 2, rate: 67 },
]
