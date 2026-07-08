/**
 * Ported from Harness Kingdom OS:
 *   src/integrations/manor/harness-workflows.ts  @ 2026-04-18
 * Pure TS — zero UI deps.
 */

import { getBusinessManorBoard, type ManorDomain } from './manor-registry'

export interface BusinessHarnessWorkflow {
  domain: Extract<ManorDomain, 'sales' | 'marketing' | 'ecommerce'>
  title: string
  entryRoute: string
  workbenchRoute: string
  opsRoute: string
  emperorSummary: string
  chancellorSummary: string
  governanceHandoff: string
  salesHandoff: string
  auditTrail: string
}

const BUSINESS_HARNESS_WORKFLOWS: Record<BusinessHarnessWorkflow['domain'], BusinessHarnessWorkflow> = {
  sales: {
    domain: 'sales',
    title: '外交部 · 销售蜂群',
    entryRoute: '/sales',
    workbenchRoute: '/sales/workbench',
    opsRoute: '/sales/ops-center',
    emperorSummary: '销售蜂群负责把对外商机推进成真实成交与回款结果，是外交部最直接的营收前线。',
    chancellorSummary: '丞相先判定是否属于对外商机，再将任务下沉给销售蜂群并联动户部、礼部与兵部节奏。',
    governanceHandoff: '可把高价值 lead 或分歧商机转入朝堂治理议题。',
    salesHandoff: '自身即销售承接终点，向 CRM、队列与 follow-up 闭环写回。',
    auditTrail: '共享审计链覆盖 governance case、mutation envelope、receipt、CRM sync 与 follow-up task。',
  },
  marketing: {
    domain: 'marketing',
    title: '外交部 · 网站营销蜂群',
    entryRoute: '/marketing',
    workbenchRoute: '/marketing/workbench',
    opsRoute: '/marketing/ops-center',
    emperorSummary: '网站营销蜂群负责官网流量、落地页转化与内容承接，把外宣势能转成可承接线索。',
    chancellorSummary: '丞相先判定是否为网站增长议题，再交给外交部的网站营销蜂群，并联动礼部与工部完成承接。',
    governanceHandoff: '分析结果可升级成治理议题，由朝堂审议实验优先级、品牌风险和资源分发。',
    salesHandoff: '高意图网站信号可直接转入销售承接线索，形成 qualify task 与审计事件。',
    auditTrail: '共享审计链应覆盖 campaign、experiment、governance case、sales lead intake 与史馆复盘。',
  },
  ecommerce: {
    domain: 'ecommerce',
    title: '远洋部 · 电商庄园',
    entryRoute: '/ecommerce',
    workbenchRoute: '/ecommerce/workbench',
    opsRoute: '/ecommerce/ops-center',
    emperorSummary: '电商庄园负责海外经营、站点承接和跨境渠道，把远洋部战果转成增长与现金流。',
    chancellorSummary: '丞相先判定是否为海外经营问题，再交给远洋部蜂群，并联动户部、工部与礼部完成执行。',
    governanceHandoff: '经营分析可转入治理议题，处理跨境资源、风险窗口和经营优先级。',
    salesHandoff: '具备高承接价值的经营信号可直接生成销售线索，交外交部继续推进。',
    auditTrail: '共享审计链应覆盖 campaign、growth lever、risk hedge、sales intake 与经营复盘。',
  },
}

export function getBusinessHarnessWorkflow(domain: BusinessHarnessWorkflow['domain']): BusinessHarnessWorkflow {
  return BUSINESS_HARNESS_WORKFLOWS[domain]
}

export function listBusinessHarnessWorkflows(): BusinessHarnessWorkflow[] {
  return Object.values(BUSINESS_HARNESS_WORKFLOWS)
}

export function listLiveBusinessHarnessWorkflows(): BusinessHarnessWorkflow[] {
  return listBusinessHarnessWorkflows().filter((workflow) => getBusinessManorBoard(workflow.domain).status === 'live')
}

export function buildGovernancePromptFromHarnessSignal(input: {
  domain: BusinessHarnessWorkflow['domain']
  signalName: string
  objective: string
  summary?: string | null
  primarySignals: string[]
  riskSignals?: string[]
  extraLines?: string[]
}): string {
  const workflow = getBusinessHarnessWorkflow(input.domain)
  return [
    `harness: ${workflow.title}`,
    `signal: ${input.signalName}`,
    `objective: ${input.objective}`,
    `summary: ${input.summary ?? '待补分析摘要'}`,
    `primary signals: ${input.primarySignals.join(' / ') || '待补关键动作'}`,
    `risk signals: ${input.riskSignals?.join(' / ') || '待补风险'}`,
    ...(input.extraLines ?? []),
  ].join('\n')
}

export function buildSalesIntakeAuditSummary(input: {
  domain: BusinessHarnessWorkflow['domain']
  signalName: string
  objective: string
  summary?: string | null
  recommendedAction?: string | null
}): string {
  const workflow = getBusinessHarnessWorkflow(input.domain)
  return [
    `${workflow.title} 信号承接`,
    `来源事项: ${input.signalName}`,
    `目标: ${input.objective}`,
    `建议动作: ${input.recommendedAction ?? '待补动作'}`,
    `摘要: ${input.summary ?? '待补分析摘要'}`,
  ].join(' · ')
}
