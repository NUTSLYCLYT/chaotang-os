/**
 * 六部注册表 —— 吏户礼兵刑工，每部主手(尚书)/副手(侍郎)双核 + 职责 + 风险关键词。
 * 纯配置，无 @/ 运行时依赖 → 可离线单测。
 */
import type { MinistryId, MinistryMeta } from './ministry-types.ts';
import { MINISTRY_IDS } from './ministry-types.ts';

export const MINISTRY_REGISTRY: Record<MinistryId, MinistryMeta> = {
  personnel: {
    id: 'personnel',
    nameCn: '吏部',
    nameEn: 'Personnel',
    modernRole: 'COO / CHRO / PMO',
    mission: '组织、人、责任、执行节奏：DRI/RACI、阻塞、7/30/90 天计划',
    vetoPower: true, // 无人负责 / 责任不清 / 无执行节奏 → 可否决推进
    riskKeywords: ['负责人', '推进', '执行', '里程碑', '90天', '组织', '协同', 'DRI', '责任', '排期'],
  },
  finance: {
    id: 'finance',
    nameCn: '户部',
    nameEn: 'Revenue',
    modernRole: 'CFO / FP&A / 投资负责人',
    mission: '预算、ROI、现金流、资源配置、付款节点、机会成本',
    vetoPower: true, // ROI 不成立 / 现金流不可承受 / 付款节点危险 → 可否决
    riskKeywords: ['预算', 'ROI', '成本', '现金', '报价', '利润', '回本', '投资', '付款', '费用', '资源'],
    // 2026-07-03 户部黄金评测(hubu_cfo_office.golden.jsonl)真跑基线发现:4/5案例都漏问这三项，
    // 即便 mission 已提 ROI/现金流——通用"缺证"指令太笼统，需要显式清单才能稳定触发。
    mustCheckGaps: [
      '止损点/退出阈值(投入到什么程度就该撤，而不是无限投入)',
      'ROI假设是否量化(预期回报率、最坏情况下的回报)',
      '本次决策对现金流的直接影响(现金消耗测算，不只是账面利润)',
    ],
  },
  ritual: {
    id: 'ritual',
    nameCn: '礼部',
    nameEn: 'Rites',
    modernRole: 'CMO / 品牌负责人 / 客户关系负责人',
    mission: '客户、品牌、对外话术、禁用表达、招商话术审查、品牌风险',
    vetoPower: true, // 对外表达越界 / 承诺过度 / 品牌风险过高 → 可否决发布
    riskKeywords: ['客户', '品牌', '招商', '话术', '对外', '宣传', '承诺', '保证收益', '口径'],
  },
  war: {
    id: 'war',
    nameCn: '兵部',
    nameEn: 'Operations',
    modernRole: 'CRO / 增长负责人 / 战略攻坚负责人',
    mission: '增长、销售、竞争、项目推进、客户决策链、90 天战役',
    vetoPower: true, // 无客户路径 / 伪机会 / 竞争劣势严重 → 可否决重投入
    riskKeywords: ['客户', '销售', '招商', '市场', '竞争', '机会', '渠道', '赢单', '试点', '合作'],
  },
  justice: {
    id: 'justice',
    nameCn: '刑部',
    nameEn: 'Justice',
    modernRole: 'CLO / 法务 / 合规 / 风控负责人',
    mission: '合同、股权、红线、风险、人工确认、红线条款库',
    vetoPower: true, // 合同/股权/重大付款/对外承诺 高风险未确认 → 硬否决
    riskKeywords: ['合同', '股权', '付款', '独家', '违约', '承诺', '预付款', '保证收益', '法务', '签字', '责任', '对外报价'],
  },
  works: {
    id: 'works',
    nameCn: '工部',
    nameEn: 'Works',
    modernRole: 'CTO / CPO / 交付负责人 / 供应链负责人',
    mission: '产品、技术、交付、供应链、实施、BOM、验收标准',
    vetoPower: true, // 交付不可行 / 缺 BOM / 无验收标准 / 技术风险过高 → 可否决承诺
    riskKeywords: ['技术', '产品', 'BOM', '设备', '施工', '交付', '供应链', '验收', 'MVP', '开发'],
  },
};

export function getMinistryById(id: string): MinistryMeta | null {
  return (MINISTRY_REGISTRY as Record<string, MinistryMeta>)[id] ?? null;
}

export function listMinistries(): MinistryMeta[] {
  return MINISTRY_IDS.map((id) => MINISTRY_REGISTRY[id]);
}
