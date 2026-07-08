/**
 * Ported from Harness Kingdom OS:
 *   src/integrations/manor/business-manors.ts  @ 2026-04-18
 * Pure TS — zero UI deps.
 *
 * Lead 类型在 V2 无对应实现，定义最小 stub，只保留 recommend 逻辑用到的字段。
 * 完整 Lead 将在 Week 3 Day 1 接入真实数据时评估是否从 Harness 平移完整模型。
 */

import type { DepartmentCode } from './departments'

export interface Lead {
  id: string
  segment: string
  company: string
  summary: string
  /** 扩展字段按需补充，不影响当前 recommend 逻辑 */
  [k: string]: unknown
}

export type ManorDomain =
  | 'sales'
  | 'marketing'
  | 'ecommerce'
  | 'legal'
  | 'hr'
  | 'finance'
  | 'ops'
  | 'compliance'

export interface BusinessManorBoard {
  domain: ManorDomain
  boardKey: string
  boardLabel: string
  boardTitle: string
  chiefTitle: string
  chiefName: string
  icon: string
  tagline: string
  mappedDepartments: DepartmentCode[]
  status: 'planned' | 'live'
}

const BUSINESS_MANOR_BOARDS: Record<ManorDomain, BusinessManorBoard> = {
  sales: {
    domain: 'sales',
    boardKey: 'waijiao',
    boardLabel: '外交台',
    boardTitle: '外交部 · 销售蜂群',
    chiefTitle: '外务大臣',
    chiefName: '苏秦',
    icon: '🤝',
    tagline: '负责线索推进、对外联络、谈判节奏与成交收口。',
    mappedDepartments: ['hubu', 'libu_rites'],
    status: 'live',
  },
  marketing: {
    domain: 'marketing',
    boardKey: 'waijiao-web',
    boardLabel: '外宣台',
    boardTitle: '外交部 · 网站营销蜂群',
    chiefTitle: '宣务大臣',
    chiefName: '张仪',
    icon: '🛰',
    tagline: '负责官网转化、落地页实验、内容承接与网站侧线索回写。',
    mappedDepartments: ['libu_rites', 'gongbu'],
    status: 'live',
  },
  ecommerce: {
    domain: 'ecommerce',
    boardKey: 'yuanyang',
    boardLabel: '远洋台',
    boardTitle: '远洋部 · 电商庄园',
    chiefTitle: '远洋大臣',
    chiefName: '郑和',
    icon: '🚢',
    tagline: '负责跨境经营、渠道拓展、站点策略与出海履约。',
    mappedDepartments: ['hubu', 'libu_rites'],
    status: 'live',
  },
  legal: {
    domain: 'legal',
    boardKey: 'falv',
    boardLabel: '法衡台',
    boardTitle: '法衡部 · 法务庄园',
    chiefTitle: '法衡大臣',
    chiefName: '张释之',
    icon: '⚖️',
    tagline: '负责争议判断、证据整理、法律意见与攻防推演。',
    mappedDepartments: ['xingbu', 'libu'],
    status: 'live',
  },
  hr: {
    domain: 'hr',
    boardKey: 'renhe',
    boardLabel: '人和台',
    boardTitle: '人和部 · 人事庄园',
    chiefTitle: '人和大臣',
    chiefName: '房玄龄',
    icon: '👥',
    tagline: '负责人事制度、组织编制、培训考核与劳动关系。',
    mappedDepartments: ['libu'],
    status: 'live',
  },
  finance: {
    domain: 'finance',
    boardKey: 'duzhi',
    boardLabel: '度支台',
    boardTitle: '度支部 · 财务庄园',
    chiefTitle: '度支大臣',
    chiefName: '桑弘羊',
    icon: '💰',
    tagline: '负责预算、现金流、测算、收益结构与财务风险。',
    mappedDepartments: ['hubu'],
    status: 'live',
  },
  ops: {
    domain: 'ops',
    boardKey: 'junwu',
    boardLabel: '军务台',
    boardTitle: '军务部 · 运营庄园',
    chiefTitle: '军务大臣',
    chiefName: '卫青',
    icon: '🛠',
    tagline: '负责运行恢复、变更调度、事故处置与工程执行。',
    mappedDepartments: ['gongbu', 'bingbu', 'xingbu'],
    status: 'live',
  },
  compliance: {
    domain: 'compliance',
    boardKey: 'jiancha',
    boardLabel: '监察台',
    boardTitle: '监察部 · 合规庄园',
    chiefTitle: '监察大臣',
    chiefName: '狄仁杰',
    icon: '🛡',
    tagline: '负责红线识别、制度检查、整改跟踪与复核验收。',
    mappedDepartments: ['xingbu', 'libu', 'prime_minister'],
    status: 'live',
  },
}

export function getBusinessManorBoard(domain: ManorDomain): BusinessManorBoard {
  return BUSINESS_MANOR_BOARDS[domain]
}

export function listBusinessManorBoards(): BusinessManorBoard[] {
  return Object.values(BUSINESS_MANOR_BOARDS)
}

export function normalizeManorDepartmentCode(input: string): DepartmentCode | null {
  switch (input) {
    case 'hubu':
      return 'hubu'
    case 'gongbu':
      return 'gongbu'
    case 'bingbu':
      return 'bingbu'
    case 'xingbu':
      return 'xingbu'
    case 'libu_hr':
      return 'libu'
    case 'libu':
      return 'libu_rites'
    case 'shangshu':
      return 'prime_minister'
    default:
      return null
  }
}

export function normalizeManorDepartmentList(inputs: string[]): DepartmentCode[] {
  return inputs
    .map(normalizeManorDepartmentCode)
    .filter((item): item is DepartmentCode => item !== null)
}

export function recommendBusinessManorsForLead(lead: Lead): BusinessManorBoard[] {
  const recommendations: ManorDomain[] = ['sales']
  const signal = `${lead.company} ${lead.title} ${lead.summary} ${lead.pain}`.toLowerCase()
  if (
    signal.includes('电商')
    || signal.includes('渠道')
    || signal.includes('出海')
    || signal.includes('零售')
    || signal.includes('跨境')
  ) {
    recommendations.push('ecommerce')
  }

  return recommendations.map(getBusinessManorBoard)
}
