/**
 * 庄园巡按 · mock 数据（CC-010）
 *
 * 扩展 palace-mock.ts 里的 ManorCard，加入巡按列表页专属字段。
 * Week 5 Day 1 接真实 legal-agent 18003 后替换。
 */

import type { ManorDomain } from './manor-registry'

export type ManorHealth = 'normal' | 'watch' | 'warning' | 'danger'

export interface ManorSummary {
  domain: ManorDomain
  code: string        // URL slug
  label: string       // 台 label
  title: string       // 全称
  chiefName: string
  chiefTitle: string
  icon: string
  health: ManorHealth
  todayCases: number
  pendingCases: number
  avgElapsedMs: number   // 平均处理时长
  approvedRate: number   // 0-1
  recentActivity: string // 最新动态摘要
}

export const MANOR_SUMMARIES: ManorSummary[] = [
  {
    domain: 'legal',
    code: 'falv',
    label: '法衡台',
    title: '法衡部 · 法务庄园',
    chiefName: '张释之',
    chiefTitle: '法衡大臣',
    icon: '⚖️',
    health: 'normal',
    todayCases: 23,
    pendingCases: 3,
    avgElapsedMs: 12400,
    approvedRate: 0.87,
    recentActivity: '11:42 · 合同审查完结 · 批红',
  },
  {
    domain: 'sales',
    code: 'waijiao',
    label: '外交台',
    title: '外交部 · 销售蜂群',
    chiefName: '苏秦',
    chiefTitle: '外务大臣',
    icon: '🤝',
    health: 'normal',
    todayCases: 19,
    pendingCases: 5,
    avgElapsedMs: 9800,
    approvedRate: 0.79,
    recentActivity: '12:05 · 新线索推进 · 转派户部',
  },
  {
    domain: 'ecommerce',
    code: 'yuanyang',
    label: '远洋台',
    title: '远洋部 · 电商庄园',
    chiefName: '郑和',
    chiefTitle: '远洋大臣',
    icon: '🚢',
    health: 'normal',
    todayCases: 27,
    pendingCases: 2,
    avgElapsedMs: 8200,
    approvedRate: 0.92,
    recentActivity: '11:58 · 跨境订单处理 · 完结',
  },
  {
    domain: 'finance',
    code: 'duzhi',
    label: '度支台',
    title: '度支部 · 财务庄园',
    chiefName: '桑弘羊',
    chiefTitle: '度支大臣',
    icon: '💰',
    health: 'watch',
    todayCases: 18,
    pendingCases: 7,
    avgElapsedMs: 15600,
    approvedRate: 0.72,
    recentActivity: '11:30 · Q1 预算复核 · 留中待议',
  },
  {
    domain: 'hr',
    code: 'renhe',
    label: '人和台',
    title: '人和部 · 人事庄园',
    chiefName: '房玄龄',
    chiefTitle: '人和大臣',
    icon: '👥',
    health: 'normal',
    todayCases: 12,
    pendingCases: 1,
    avgElapsedMs: 7100,
    approvedRate: 0.91,
    recentActivity: '10:55 · 用工合规审查 · 批红',
  },
  {
    domain: 'ops',
    code: 'junwu',
    label: '军务台',
    title: '军务部 · 运营庄园',
    chiefName: '卫青',
    chiefTitle: '军务大臣',
    icon: '🛠',
    health: 'warning',
    todayCases: 9,
    pendingCases: 4,
    avgElapsedMs: 21300,
    approvedRate: 0.55,
    recentActivity: '12:10 · 错误率告警 · 正在处理',
  },
  {
    domain: 'compliance',
    code: 'jiancha',
    label: '监察台',
    title: '监察部 · 合规庄园',
    chiefName: '狄仁杰',
    chiefTitle: '监察大臣',
    icon: '🛡',
    health: 'normal',
    todayCases: 11,
    pendingCases: 2,
    avgElapsedMs: 11200,
    approvedRate: 0.84,
    recentActivity: '11:15 · GDPR 条款复核 · 完结',
  },
  {
    domain: 'marketing',
    code: 'waijiao-web',
    label: '外宣台',
    title: '外交部 · 网站营销蜂群',
    chiefName: '张仪',
    chiefTitle: '宣务大臣',
    icon: '🛰',
    health: 'watch',
    todayCases: 8,
    pendingCases: 3,
    avgElapsedMs: 10500,
    approvedRate: 0.75,
    recentActivity: '11:02 · 落地页实验审批 · 转派',
  },
]

export const HEALTH_LABEL: Record<ManorHealth, string> = {
  normal: '正常',
  watch: '关注',
  warning: '预警',
  danger: '危险',
}

export const HEALTH_COLOR: Record<ManorHealth, string> = {
  normal: 'var(--color-success)',
  watch: 'var(--color-info)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
}

export function formatElapsed(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}秒`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}分钟`
  return `${(ms / 3_600_000).toFixed(1)}小时`
}

export function getManorsByHealth(health: ManorHealth | 'all'): ManorSummary[] {
  if (health === 'all') return MANOR_SUMMARIES
  return MANOR_SUMMARIES.filter(m => m.health === health)
}
