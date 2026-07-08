/**
 * 朝堂大殿 · mock 数据（Week 3）
 *
 * 结构严格对齐 V2 overview 的 mock fixtures 模式。
 * Week 3 Day 3 接真实 legal-agent 18003 后，本文件只保留单元测试用。
 */

import type { DecisionKind, PetitionStation } from '../types'
import type { ManorDomain } from './manor-registry'
import type { DepartmentCode } from './departments'

export interface PalaceDigest {
  todayPetitions: number
  approvedRate: number // 0-1
  suspendedCount: number
  rejectedCount: number
}

export interface ActivePetition {
  id: string
  summary: string
  currentStation: PetitionStation
  elapsedMs: number
  /** 最近一个 committed 的 decision */
  lastDecision: DecisionKind | null
}

export interface MinistryLoad {
  code: Exclude<DepartmentCode, 'prime_minister' | 'shiguan'>
  name: string
  activeCount: number
  /** -1/0/+1 相对昨日 */
  trend: -1 | 0 | 1
}

export interface ManorCard {
  domain: ManorDomain
  name: string
  health: 'normal' | 'watch' | 'warning' | 'danger'
  todayCases: number
}

export interface RiskHint {
  id: string
  team: 'red' | 'blue'
  content: string
  petitionId: string
}

export interface PalaceSnapshot {
  digest: PalaceDigest
  activePetitions: ActivePetition[]
  ministries: MinistryLoad[]
  manors: ManorCard[]
  risks: RiskHint[]
}

/** Mock snapshot — 数字手写真实可信，不过于整齐 */
export const PALACE_SNAPSHOT: PalaceSnapshot = {
  digest: {
    todayPetitions: 132,
    approvedRate: 0.92,
    suspendedCount: 5,
    rejectedCount: 3,
  },
  activePetitions: [
    {
      id: 'pet_m3xyz18',
      summary: '合同第五条 GDPR 冲突复查',
      currentStation: 'legal',
      elapsedMs: 8400,
      lastDecision: 'forwarded',
    },
    {
      id: 'pet_m3x92pq',
      summary: 'Q1 电商大促 KPI 复盘',
      currentStation: 'ecommerce',
      elapsedMs: 14200,
      lastDecision: 'approved',
    },
    {
      id: 'pet_m3wz8hh',
      summary: 'HR 候选池盘点 · 三主线',
      currentStation: 'hr',
      elapsedMs: 4500,
      lastDecision: 'forwarded',
    },
    {
      id: 'pet_m3wy4aa',
      summary: '供应商财务尽调 · B 轮',
      currentStation: 'finance',
      elapsedMs: 22100,
      lastDecision: 'suspended',
    },
    {
      id: 'pet_m3wx0kk',
      summary: '生产告警复盘 · 灰度切换',
      currentStation: 'ops',
      elapsedMs: 3800,
      lastDecision: 'forwarded',
    },
  ],
  ministries: [
    { code: 'libu', name: '吏部', activeCount: 7, trend: 1 },
    { code: 'hubu', name: '户部', activeCount: 12, trend: 0 },
    { code: 'libu_rites', name: '礼部', activeCount: 3, trend: -1 },
    { code: 'bingbu', name: '兵部', activeCount: 5, trend: 1 },
    { code: 'xingbu', name: '刑部', activeCount: 9, trend: 0 },
    { code: 'gongbu', name: '工部', activeCount: 6, trend: 0 },
  ],
  manors: [
    { domain: 'legal', name: '法律庄园', health: 'normal', todayCases: 23 },
    { domain: 'finance', name: '财务庄园', health: 'watch', todayCases: 18 },
    { domain: 'hr', name: 'HR 庄园', health: 'normal', todayCases: 12 },
    { domain: 'ecommerce', name: '电商庄园', health: 'normal', todayCases: 27 },
    { domain: 'ops', name: '运维庄园', health: 'warning', todayCases: 9 },
    { domain: 'compliance', name: '合规庄园', health: 'normal', todayCases: 11 },
    { domain: 'sales', name: '销售庄园', health: 'normal', todayCases: 19 },
    { domain: 'marketing', name: '市场庄园', health: 'watch', todayCases: 8 },
  ],
  risks: [
    {
      id: 'risk_a1',
      team: 'red',
      content: '合同第五条赔偿上限与 GDPR 冲突 · 建议返庄园重核',
      petitionId: 'pet_m3xyz18',
    },
    {
      id: 'risk_b2',
      team: 'blue',
      content: 'Q1 复盘数据缺失 15 条 · 已联动户部补齐',
      petitionId: 'pet_m3x92pq',
    },
    {
      id: 'risk_a3',
      team: 'red',
      content: '运维庄园近 1h 错误率 +3%',
      petitionId: 'pet_m3wx0kk',
    },
  ],
}
