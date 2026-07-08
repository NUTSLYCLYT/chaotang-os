/**
 * 刑部回档 · mock 数据（CC-012）
 *
 * 每条案卷包含：基本信息 + 6站时间轴事件 + reasoning 摘要
 * 脱敏规则：model → 近臣/高层/国老；token → 不展示
 */

import type { DecisionKind } from '../types'

export type AuditGroup = 'today' | 'yesterday' | 'before'

export interface AuditTimelineEvent {
  seq: number
  station: string
  stationLabel: string
  decisionKind: DecisionKind | null
  elapsedMs: number
  reasoning: string
  annotation: string
}

export interface AuditRecord {
  id: string
  petitionId: string
  title: string
  group: AuditGroup
  timestamp: string
  totalElapsedMs: number
  finalDecision: DecisionKind
  manor: string
  archived: boolean
  timeline: AuditTimelineEvent[]
}

export const AUDIT_RECORDS: AuditRecord[] = [
  {
    id: 'a001',
    petitionId: 'pet_m3xyz18',
    title: '合同第五条 GDPR 合规复查',
    group: 'today',
    timestamp: '11:42',
    totalElapsedMs: 12400,
    finalDecision: 'approved',
    manor: '法衡台',
    archived: false,
    timeline: [
      { seq: 1, station: 'crown_prince', stationLabel: '太子', decisionKind: null,      elapsedMs: 800,  reasoning: '收到奏折，初步审阅合同第五条款内容，判断需要专项法律审查。', annotation: '启动合规审查流程' },
      { seq: 2, station: 'zhongshu',    stationLabel: '中书', decisionKind: 'forwarded', elapsedMs: 1200, reasoning: '中书令核查合同背景，识别欧盟数据保护条例适用范围，转交门下省专项审查。', annotation: '转法务专项' },
      { seq: 3, station: 'menxia',      stationLabel: '门下', decisionKind: null,        elapsedMs: 2100, reasoning: '门下省审核 GDPR 第 28 条处理者义务，对照合同第五条赔偿上限条款，发现潜在冲突。', annotation: '识别条款冲突' },
      { seq: 4, station: 'shangshu',    stationLabel: '尚书', decisionKind: null,        elapsedMs: 3400, reasoning: '尚书台综合法律意见与商业影响评估，建议附加补充条款以满足 GDPR 要求，不建议否决整份合同。', annotation: '综合评估' },
      { seq: 5, station: 'liubu',       stationLabel: '六部', decisionKind: 'forwarded', elapsedMs: 2800, reasoning: '法衡台接收审查任务，针对第五条款提出具体修改方案：将赔偿上限调整为合同金额 200% 以符合 GDPR 第 83 条。', annotation: '修改方案' },
      { seq: 6, station: 'manor',       stationLabel: '庄园', decisionKind: 'approved',  elapsedMs: 2100, reasoning: '最终决定：采纳修改方案，合同第五条款调整后符合 GDPR 要求。批红通过，建议在补充协议中确认。', annotation: '批红通过' },
    ],
  },
  {
    id: 'a002',
    petitionId: 'pet_m3a2bc',
    title: 'Q1 电商大促 KPI 复盘',
    group: 'today',
    timestamp: '10:15',
    totalElapsedMs: 9800,
    finalDecision: 'approved',
    manor: '外交台',
    archived: false,
    timeline: [
      { seq: 1, station: 'crown_prince', stationLabel: '太子', decisionKind: null,      elapsedMs: 600,  reasoning: '收到 Q1 大促复盘奏折，数据量较大，需要多部门协同分析。', annotation: '启动复盘' },
      { seq: 2, station: 'zhongshu',    stationLabel: '中书', decisionKind: null,        elapsedMs: 1100, reasoning: '整合各渠道销售数据，识别关键 KPI 达成情况：GMV 超预期 12%，转化率下滑 3pp。', annotation: '数据整合' },
      { seq: 3, station: 'menxia',      stationLabel: '门下', decisionKind: null,        elapsedMs: 1800, reasoning: '深度分析转化率下滑原因：页面加载速度在大促期间 p99 达 4.2s，用户流失率升高。', annotation: '根因分析' },
      { seq: 4, station: 'shangshu',    stationLabel: '尚书', decisionKind: null,        elapsedMs: 2200, reasoning: '综合销售、技术、用户体验三个维度，整体评估 Q1 大促为良好，提出 Q2 改进方向。', annotation: '综合评估' },
      { seq: 5, station: 'liubu',       stationLabel: '六部', decisionKind: 'forwarded', elapsedMs: 2400, reasoning: '技术改进建议：CDN 预热策略升级、图片懒加载优化、关键路径接口缓存增强。', annotation: '改进方案' },
      { seq: 6, station: 'manor',       stationLabel: '庄园', decisionKind: 'approved',  elapsedMs: 1700, reasoning: 'Q1 复盘批红通过，改进方案已立项，Q2 大促前须完成技术升级验收。', annotation: '批红' },
    ],
  },
  {
    id: 'a003',
    petitionId: 'pet_m3x92pq',
    title: '供应商财务评测 · B 轮',
    group: 'today',
    timestamp: '09:05',
    totalElapsedMs: 22100,
    finalDecision: 'suspended',
    manor: '度支台',
    archived: false,
    timeline: [
      { seq: 1, station: 'crown_prince', stationLabel: '太子', decisionKind: null,      elapsedMs: 900,  reasoning: '收到供应商 B 轮融资尽调奏折，财务数据复杂，需要深度审查。', annotation: '启动尽调' },
      { seq: 2, station: 'zhongshu',    stationLabel: '中书', decisionKind: null,        elapsedMs: 2800, reasoning: '整理供应商三年财务报告，发现 2024 年应收账款周转率异常下滑（从 8.2 降至 5.1）。', annotation: '财务异常识别' },
      { seq: 3, station: 'menxia',      stationLabel: '门下', decisionKind: null,        elapsedMs: 4200, reasoning: '深入调查应收账款问题，发现主要客户集中度过高（前 3 客户占 67%），存在单一客户依赖风险。', annotation: '风险评估' },
      { seq: 4, station: 'shangshu',    stationLabel: '尚书', decisionKind: null,        elapsedMs: 5600, reasoning: '综合评估：业务基本面良好，但客户集中度风险和应收账款问题需要进一步澄清，建议补充资料。', annotation: '待补充' },
      { seq: 5, station: 'liubu',       stationLabel: '六部', decisionKind: null,        elapsedMs: 4800, reasoning: '度支台建议：要求供应商提供客户合同续签率数据及应收账款账龄分析，30 天内回复。', annotation: '要求补充' },
      { seq: 6, station: 'manor',       stationLabel: '庄园', decisionKind: 'suspended', elapsedMs: 3800, reasoning: '留中待议：等待供应商补充资料后重新评审。本次尽调资料存档，30 天内复查。', annotation: '留中' },
    ],
  },
  {
    id: 'a004',
    petitionId: 'pet_m2yz77',
    title: 'HR 绩效选拔 · 三主线方案',
    group: 'yesterday',
    timestamp: '15:30',
    totalElapsedMs: 7100,
    finalDecision: 'approved',
    manor: '人和台',
    archived: true,
    timeline: [
      { seq: 1, station: 'crown_prince', stationLabel: '太子', decisionKind: null,      elapsedMs: 500,  reasoning: '收到 Q2 绩效方案奏折，要求对三条主线（技术/产品/运营）分别制定评估标准。', annotation: '方案拆解' },
      { seq: 2, station: 'zhongshu',    stationLabel: '中书', decisionKind: null,        elapsedMs: 1000, reasoning: '汇整各部门 KPI 数据，识别三条主线的差异化需求。', annotation: '需求分析' },
      { seq: 3, station: 'menxia',      stationLabel: '门下', decisionKind: null,        elapsedMs: 1500, reasoning: '审核方案合规性，确保绩效标准符合劳动法及公司制度要求。', annotation: '合规审核' },
      { seq: 4, station: 'shangshu',    stationLabel: '尚书', decisionKind: null,        elapsedMs: 1800, reasoning: '综合三条主线方案，建议采用 OKR + 360 度评估的混合模式。', annotation: '方案优化' },
      { seq: 5, station: 'liubu',       stationLabel: '六部', decisionKind: 'forwarded', elapsedMs: 1400, reasoning: '人和台落地执行计划，明确 Q2 绩效周期、评分权重及晋升通道。', annotation: '执行计划' },
      { seq: 6, station: 'manor',       stationLabel: '庄园', decisionKind: 'approved',  elapsedMs: 900,  reasoning: 'Q2 绩效方案批红，即日起执行。三条主线负责人确认。', annotation: '批红归档' },
    ],
  },
  {
    id: 'a005',
    petitionId: 'pet_m2ab34',
    title: '生产告警灰度切换复查',
    group: 'yesterday',
    timestamp: '11:20',
    totalElapsedMs: 14500,
    finalDecision: 'rejected',
    manor: '军务台',
    archived: true,
    timeline: [
      { seq: 1, station: 'crown_prince', stationLabel: '太子', decisionKind: null,      elapsedMs: 700,  reasoning: '收到灰度切换审批奏折，需要在 4 小时内决策。', annotation: '紧急审批' },
      { seq: 2, station: 'zhongshu',    stationLabel: '中书', decisionKind: null,        elapsedMs: 1800, reasoning: '审查切换方案：新版本错误率在预发环境为 2.1%，超过 1.5% 的上线阈值。', annotation: '指标异常' },
      { seq: 3, station: 'menxia',      stationLabel: '门下', decisionKind: null,        elapsedMs: 2900, reasoning: '深入分析：错误集中在旧客户端版本兼容处理，影响约 8% 的存量用户。', annotation: '影响评估' },
      { seq: 4, station: 'shangshu',    stationLabel: '尚书', decisionKind: null,        elapsedMs: 3800, reasoning: '综合评估：新功能商业价值较高，但现阶段错误率风险不可接受，建议驳回并修复后重提。', annotation: '风险不可接受' },
      { seq: 5, station: 'liubu',       stationLabel: '六部', decisionKind: 'forwarded', elapsedMs: 3200, reasoning: '军务台出具驳回意见：要求修复旧版本兼容问题，错误率降至 0.5% 以下后重新申请。', annotation: '提出整改要求' },
      { seq: 6, station: 'manor',       stationLabel: '庄园', decisionKind: 'rejected',  elapsedMs: 2100, reasoning: '驳回：旧版本兼容问题未修复，存在影响存量用户风险。整改后可重提。', annotation: '驳回' },
    ],
  },
  {
    id: 'a006',
    petitionId: 'pet_m1qq99',
    title: '知识产权纠纷推演 · 攻防',
    group: 'before',
    timestamp: '前天 16:45',
    totalElapsedMs: 18900,
    finalDecision: 'approved',
    manor: '法衡台',
    archived: true,
    timeline: [
      { seq: 1, station: 'crown_prince', stationLabel: '太子', decisionKind: null,      elapsedMs: 800,  reasoning: '收到知识产权纠纷推演请求，需要进行攻防两方模拟。', annotation: '启动推演' },
      { seq: 2, station: 'zhongshu',    stationLabel: '中书', decisionKind: null,        elapsedMs: 2200, reasoning: '整理案件基础资料：专利申请日期、权利要求范围、被控侵权产品特征对比。', annotation: '证据整理' },
      { seq: 3, station: 'menxia',      stationLabel: '门下', decisionKind: null,        elapsedMs: 4100, reasoning: '攻方推演：分析专利权利要求第1、3、7项与被控产品的映射关系，评估胜诉概率约65%。', annotation: '攻方分析' },
      { seq: 4, station: 'shangshu',    stationLabel: '尚书', decisionKind: null,        elapsedMs: 5300, reasoning: '守方推演：识别专利无效化路径（现有技术抗辩），以及技术规避改造的可行方案。', annotation: '守方策略' },
      { seq: 5, station: 'liubu',       stationLabel: '六部', decisionKind: 'forwarded', elapsedMs: 3800, reasoning: '综合攻守双方推演，建议优先寻求庭外和解，同时保留技术规避方案作为备选。', annotation: '综合建议' },
      { seq: 6, station: 'manor',       stationLabel: '庄园', decisionKind: 'approved',  elapsedMs: 2700, reasoning: '攻防推演完成，和解方案已制定。批红通过，授权法务团队开展和解谈判。', annotation: '批红' },
    ],
  },
]

export const GROUP_LABELS: Record<AuditGroup, string> = {
  today: '今日',
  yesterday: '昨日',
  before: '前天及更早',
}

export const DECISION_LABEL: Record<DecisionKind, string> = {
  approved: '批红',
  rejected: '驳回',
  suspended: '留中',
  forwarded: '转派',
}

export const DECISION_COLOR: Record<DecisionKind, string> = {
  approved: 'var(--color-success)',
  rejected: 'var(--color-danger)',
  suspended: 'var(--color-warning)',
  forwarded: 'var(--color-info)',
}

export function formatElapsedMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m`
}

export function groupedRecords(records: AuditRecord[]): Record<AuditGroup, AuditRecord[]> {
  return {
    today:     records.filter(r => r.group === 'today'),
    yesterday: records.filter(r => r.group === 'yesterday'),
    before:    records.filter(r => r.group === 'before'),
  }
}
