/**
 * 庄园巡按 · 详情页 mock 数据（CC-011）
 *
 * 每个庄园的近期案卷 + 红蓝队摘要 + 蜂群节点。
 * 按 manor code（boardKey）索引。
 */

export interface CaseRecord {
  id: string
  title: string
  status: 'approved' | 'rejected' | 'suspended' | 'in_progress'
  elapsedMs: number
  timestamp: string
  station: string
}

export interface SwarmNode {
  id: string
  role: string
  nameCn: string
  status: 'active' | 'idle' | 'busy'
  casesToday: number
}

export interface RiskSummary {
  team: 'red' | 'blue'
  title: string
  content: string
  severity: 'high' | 'medium' | 'low'
}

export interface ManorDetail {
  code: string
  recentCases: CaseRecord[]
  swarmNodes: SwarmNode[]
  redBlue: RiskSummary[]
  weeklyTrend: { day: string; cases: number; approved: number }[]
}

const STATUS_LABEL: Record<CaseRecord['status'], string> = {
  approved: '批红',
  rejected: '驳回',
  suspended: '留中',
  in_progress: '处理中',
}

export { STATUS_LABEL }

const MANOR_DETAILS: Record<string, ManorDetail> = {
  falv: {
    code: 'falv',
    recentCases: [
      { id: 'c001', title: '跨境电商合规审查', status: 'approved', elapsedMs: 11200, timestamp: '12:03', station: '六部' },
      { id: 'c002', title: 'GDPR 数据处理协议', status: 'approved', elapsedMs: 9800, timestamp: '11:45', station: '庄园' },
      { id: 'c003', title: '劳动仲裁证据整理', status: 'in_progress', elapsedMs: 5400, timestamp: '11:30', station: '门下' },
      { id: 'c004', title: 'SaaS 服务协议审定', status: 'approved', elapsedMs: 14200, timestamp: '10:58', station: '庄园' },
      { id: 'c005', title: '知识产权纠纷推演', status: 'suspended', elapsedMs: 22100, timestamp: '10:22', station: '尚书' },
      { id: 'c006', title: '供应商框架合同复核', status: 'approved', elapsedMs: 8700, timestamp: '09:55', station: '庄园' },
      { id: 'c007', title: '股权激励合规性评估', status: 'rejected', elapsedMs: 16500, timestamp: '09:18', station: '六部' },
    ],
    swarmNodes: [
      { id: 'n1', role: '主审', nameCn: '张释之', status: 'active', casesToday: 8 },
      { id: 'n2', role: '复核', nameCn: '廷尉甲', status: 'busy', casesToday: 5 },
      { id: 'n3', role: '文书', nameCn: '廷尉乙', status: 'active', casesToday: 6 },
      { id: 'n4', role: '检索', nameCn: '廷尉丙', status: 'idle', casesToday: 2 },
      { id: 'n5', role: '裁量', nameCn: '廷尉丁', status: 'active', casesToday: 7 },
      { id: 'n6', role: '归档', nameCn: '廷尉戊', status: 'busy', casesToday: 4 },
      { id: 'n7', role: '推演', nameCn: '廷尉己', status: 'active', casesToday: 3 },
    ],
    redBlue: [
      { team: 'red', title: 'GDPR 与本地法律冲突', content: '第三条赔偿上限与欧盟新规存在冲突，建议在下次合同修订前暂停相关条款执行。', severity: 'high' },
      { team: 'blue', title: '标准化模板收益', content: '引入合同标准化模板后，复核时间缩短 34%，本周可处理案量预计提升 20%。', severity: 'medium' },
      { team: 'red', title: '仲裁证据时限风险', content: '案 c003 证据提交期限 3 日后到期，若未完成整理将影响仲裁结果。', severity: 'high' },
    ],
    weeklyTrend: [
      { day: '周一', cases: 18, approved: 15 },
      { day: '周二', cases: 21, approved: 18 },
      { day: '周三', cases: 19, approved: 17 },
      { day: '周四', cases: 25, approved: 20 },
      { day: '周五', cases: 23, approved: 20 },
    ],
  },
  waijiao: {
    code: 'waijiao',
    recentCases: [
      { id: 'c001', title: 'A 客户二期续约推进', status: 'in_progress', elapsedMs: 8200, timestamp: '12:10', station: '六部' },
      { id: 'c002', title: 'B 集团顶层拜访策略', status: 'approved', elapsedMs: 7100, timestamp: '11:52', station: '庄园' },
      { id: 'c003', title: '竞品对标分析报告', status: 'approved', elapsedMs: 5800, timestamp: '11:34', station: '庄园' },
      { id: 'c004', title: 'C 企业新线索评估', status: 'approved', elapsedMs: 4200, timestamp: '11:05', station: '六部' },
      { id: 'c005', title: 'D 渠道伙伴谈判', status: 'suspended', elapsedMs: 12400, timestamp: '10:30', station: '尚书' },
      { id: 'c006', title: '季度复盘客户分层', status: 'approved', elapsedMs: 9300, timestamp: '09:48', station: '庄园' },
      { id: 'c007', title: 'E 集团年框协议推进', status: 'in_progress', elapsedMs: 6700, timestamp: '09:12', station: '门下' },
    ],
    swarmNodes: [
      { id: 'n1', role: '主将', nameCn: '苏秦', status: 'active', casesToday: 7 },
      { id: 'n2', role: '线索', nameCn: '外务甲', status: 'busy', casesToday: 4 },
      { id: 'n3', role: '谈判', nameCn: '外务乙', status: 'active', casesToday: 5 },
      { id: 'n4', role: '策略', nameCn: '外务丙', status: 'active', casesToday: 3 },
      { id: 'n5', role: '客情', nameCn: '外务丁', status: 'idle', casesToday: 2 },
      { id: 'n6', role: '报价', nameCn: '外务戊', status: 'busy', casesToday: 6 },
      { id: 'n7', role: '归档', nameCn: '外务己', status: 'active', casesToday: 1 },
    ],
    redBlue: [
      { team: 'red', title: 'D 渠道谈判进入僵局', content: '价格分歧超出预设弹性区间，建议升级至主将介入或引入第三方调解。', severity: 'high' },
      { team: 'blue', title: '新线索转化率创历史高', content: '本周 AI 辅助评估命中率 82%，较人工筛选提升 28pp。', severity: 'low' },
    ],
    weeklyTrend: [
      { day: '周一', cases: 15, approved: 11 },
      { day: '周二', cases: 17, approved: 13 },
      { day: '周三', cases: 16, approved: 12 },
      { day: '周四', cases: 20, approved: 16 },
      { day: '周五', cases: 19, approved: 15 },
    ],
  },
}

export function getManorDetail(code: string): ManorDetail {
  return (
    MANOR_DETAILS[code] ?? {
      code,
      recentCases: [],
      swarmNodes: [],
      redBlue: [],
      weeklyTrend: [],
    }
  )
}
