/**
 * 朝堂 Console · 庄园域自动识别（CC-014）
 *
 * 简单关键词分类，把奏折文本路由到 legal-agent 的正确庄园。
 * 不依赖 LLM，零延迟，demo 够用。
 */

import type { PetitionStation } from '../types'

type Domain = Extract<PetitionStation, 'legal' | 'hr' | 'finance' | 'ecommerce' | 'ops' | 'compliance'>

const RULES: [Domain, string[]][] = [
  ['legal',      ['合同', '法律', '合规', '条款', '诉讼', '知识产权', '侵权', '违约', 'gdpr', 'contract', 'legal', 'ip纠纷', '专利', '协议']],
  ['hr',         ['绩效', '员工', '招聘', '薪酬', '人力', '劳动合同', '考核', '晋升', '离职', '入职', 'hr', '薪资']],
  ['finance',    ['财务', '资金', '预算', '融资', '现金流', '审计', '报表', '尽调', 'b轮', 'a轮', 'c轮', '财报', '账期', '应收']],
  ['ecommerce',  ['电商', '大促', '转化率', 'gmv', '复盘', '运营', '用户留存', '直播', '商品', '购物', '订单']],
  ['ops',        ['运维', '告警', '部署', '灰度', '回滚', '监控', '服务器', '上线', 'p99', '错误率']],
  ['compliance', ['合规', '数据安全', 'gdpr', '隐私', '数据保护', '监管', '审查', '反洗钱', 'kyc']],
]

export function detectDomain(text: string): Domain {
  const lower = text.toLowerCase()
  for (const [domain, keywords] of RULES) {
    if (keywords.some(kw => lower.includes(kw))) return domain
  }
  return 'legal'
}
