/**
 * 朝堂 Console · 术语翻译表
 *
 * UI 原则 (70-UI_PRINCIPLES §4)：
 *   每个古代术语第一次出现时必须能 hover 显示解释。
 *   解释 < 20 字，用小白听得懂的语言，不暴露技术概念。
 */

import type { PetitionStage, PetitionStation } from '../types'

export interface GlossaryEntry {
  /** 中文原词 */
  term: string
  /** 小白向解释，< 20 字 */
  explain: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // 治理层（丞相 / 太子 / 中书 / 门下 / 尚书）
  chengxiang: { term: '丞相', explain: '拟旨编排官 · 主持会审,有旨才动' },
  taizi: { term: '太子', explain: '需求收口官 · 接收并理解你的问题' },
  zhongshu: { term: '中书', explain: '任务拆解官 · 起草可执行方案' },
  menxia: { term: '门下', explain: '审议官 · 判断方案是否合理' },
  shangshu: { term: '尚书', explain: '分派官 · 把任务派到对应庄园' },

  // 六部
  gongbu: { term: '工部', explain: '工程与部署' },
  bingbu: { term: '兵部', explain: '值守与容量告警' },
  xingbu: { term: '刑部', explain: '审计与复盘' },
  hubu: { term: '户部', explain: '财务与报表' },
  libu_hr: { term: '吏部', explain: '人事与组织' },
  libu_rites: { term: '礼部', explain: '对外与规范' },

  // 八庄园
  legal: { term: '法律庄园', explain: '合同 · 合规 · 法律推理' },
  hr: { term: 'HR 庄园', explain: '招聘 · 组织 · 人效' },
  finance: { term: '财务庄园', explain: '资金 · 预算 · 报表' },
  ecommerce: { term: '电商庄园', explain: '营销 · 选品 · 运营' },
  ops: { term: '运维庄园', explain: '容量 · 告警 · 稳定性' },
  compliance: { term: '合规庄园', explain: '审计 · 风控 · 合规' },

  // 奏折状态
  submitted: { term: '递交', explain: '奏折刚递上来' },
  drafting: { term: '票拟', explain: '正在起草方案' },
  reviewing: { term: '批红', explain: '已批示通过' },
  suspended: { term: '留中', explain: '暂时搁置，待成熟' },
  rejected: { term: '驳回', explain: '退回补充' },
  executed: { term: '奉行', explain: '已执行完成' },

  // 决策类型
  approved: { term: '批红', explain: '通过并下发执行' },
  forwarded: { term: '转派', explain: '转下一站处理' },
}

/** 站名 → 中文 label */
export function stationLabel(station: PetitionStation): string {
  return GLOSSARY[station]?.term ?? station
}

/** 站名 → 悬浮解释 */
export function stationExplain(station: PetitionStation): string {
  return GLOSSARY[station]?.explain ?? ''
}

/** Stage → 中文 label */
export function stageLabel(stage: PetitionStage): string {
  const map: Record<PetitionStage, string> = {
    taizi: '太子',
    zhongshu: '中书',
    menxia: '门下',
    shangshu: '尚书',
    liubu: '六部',
    manor: '庄园',
  }
  return map[stage]
}

/** 按朝堂层级顺序排列的六站 key */
export const STAGES_IN_ORDER: PetitionStage[] = [
  'taizi',
  'zhongshu',
  'menxia',
  'shangshu',
  'liubu',
  'manor',
]
