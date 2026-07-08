// src/core/courtos/department-flywheel/hubu/config.ts
import type { FlywheelConfig } from '../types';
// v1 极严:先严后松。每轮最多 2 条。
export const HUBU_FLYWHEEL_CONFIG: FlywheelConfig = { maxPerRun: 2 };
// 阈值:金额(元)下限。
export const HUBU_MIN_BUDGET_YUAN = 500_000;
// 户部语义关键词。
export const HUBU_KEYWORDS = ['预算', '成本', '报价', 'ROI', '采购', '付款', '现金', '回款', '投入'];
