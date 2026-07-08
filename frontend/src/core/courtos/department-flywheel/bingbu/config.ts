// src/core/courtos/department-flywheel/bingbu/config.ts
import type { FlywheelConfig } from '../types';
// v1 极严：先严后松。每轮最多 2 条。
export const BINGBU_FLYWHEEL_CONFIG: FlywheelConfig = { maxPerRun: 2 };
// 兵部销售语义关键词（与 CRO 引擎分类逻辑对齐）。
export const BINGBU_KEYWORDS = [
  '报价', '谈判', '客户', '商机', '渠道', '续约', '线索', '成交',
  '销售', '合同', '折扣', '竞品', '大客户', '复购', '代理', '经销',
  '伙伴', '毛利', '压价', '预算', '回款', '销售负责人',
];
