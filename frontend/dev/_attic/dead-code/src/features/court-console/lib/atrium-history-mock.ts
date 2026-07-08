export type PetitionStatus = 'approved' | 'rejected' | 'suspended'

export interface HistoryPetition {
  id: string
  title: string
  manor: string
  elapsed: string
  status: PetitionStatus
  createdAt: string
  summary: string
}

export const HISTORY_PETITIONS: HistoryPetition[] = [
  {
    id: 'pet_demo_001',
    title: 'Q1 电商大促 KPI 复盘',
    manor: '法衡台',
    elapsed: '12.4s',
    status: 'approved',
    createdAt: '今日 10:24',
    summary: '分析 Q1 大促期间 GMV、转化率、退货率三项核心指标，输出改善建议',
  },
  {
    id: 'pet_demo_002',
    title: 'GDPR 合同第三条款审查',
    manor: '外交台',
    elapsed: '9.8s',
    status: 'approved',
    createdAt: '今日 09:55',
    summary: '审查供应商合同 GDPR 合规条款，标注风险点并给出修改意见',
  },
  {
    id: 'pet_demo_003',
    title: '供应商财务评测 · B 轮',
    manor: '度支台',
    elapsed: '22.1s',
    status: 'suspended',
    createdAt: '今日 09:31',
    summary: '对候选供应商进行 B 轮融资尽调，评估财务健康度与合作风险',
  },
  {
    id: 'pet_demo_004',
    title: 'HR 绩效选拔点 · 三主线',
    manor: '人和台',
    elapsed: '4.5s',
    status: 'approved',
    createdAt: '昨日 17:08',
    summary: '制定 Q2 绩效评估三条主线：业绩贡献、团队协作、能力成长',
  },
  {
    id: 'pet_demo_005',
    title: '知识产权侵权风险初筛',
    manor: '法衡台',
    elapsed: '18.7s',
    status: 'rejected',
    createdAt: '昨日 14:22',
    summary: '扫描近期产品功能更新是否触碰竞争对手专利，生成风险清单',
  },
  {
    id: 'pet_demo_006',
    title: '新零售合作方尽调报告',
    manor: '商贾台',
    elapsed: '31.2s',
    status: 'approved',
    createdAt: '昨日 11:40',
    summary: '对接洽新零售合作方进行全面尽调：资质、财务、口碑、团队',
  },
  {
    id: 'pet_demo_007',
    title: '劳动合同范本更新',
    manor: '人和台',
    elapsed: '8.3s',
    status: 'approved',
    createdAt: '前天 16:05',
    summary: '根据最新劳动法修订更新标准劳动合同范本，标注关键修改点',
  },
]
