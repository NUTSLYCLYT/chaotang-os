/**
 * 上书房 · 常量（资源路径 + 顶部导航 + 快捷旨意）
 */

import {
  CHAOTANG_V1_LIUBU,
  CHAOTANG_V1_PRIMARY_MODULES,
  CHAOTANG_V1_ZHUANSHU,
} from '@/config/chaotang-v1-modules';
import type { NavItem } from './types';

/** 静态资源（public/shangshufang/，从 Figma 导出 + 处理） */
export const SHANGSHUFANG_ASSETS = {
  /** 实时背景：原画清晰+暖色压暗，保留拱窗/明月/书案场景（1:1 还原） */
  bgScene: '/shangshufang/bg-shangshufang-scene.webp',
  /** 原画全幅（留档参考） */
  bgFull: '/shangshufang/bg-shangshufang-full.webp',
  /** 丞相立像（大幅，hat-to-hands） */
  portraitChancellor: '/heroes/character-roster/v5-command-center-zhuge-liang.webp',
  /** 钦天监立像 */
  portraitWang: '/heroes/character-roster/forecast-zhang-heng.webp',
} as const;

/**
 * 顶部部门导航。
 * href 对齐 (dashboard) 路由组实际存在的 9 模块路径
 * (与 src/app/(dashboard)/layout.tsx 原版 COURT_MODULES 保持一致)。
 * ChaotangTopNav 用 Link + usePathname 自动高亮当前页。
 */
/**
 * 减法 A(2026-06-03):顶导 11 → 6 核心 + 二级菜单,避免皇帝被入口淹没。
 * 核心(高频、皇帝视角)直挂顶导;六部与专署收进下拉。
 */
export const CORE_NAV: NavItem[] = CHAOTANG_V1_PRIMARY_MODULES.map((item) => ({
  key: item.id,
  label: item.label,
  href: item.href,
}));

/** 核心专署入口:顶导单独渲染,不混入六部/专署下拉。 */
export const MANOR_NAV: NavItem = { key: 'zhuanshu', label: '专署', href: '/zhuanshu' };

/** 二级"六部"菜单:只放传统六部,不混入专署。 */
export const SIX_MINISTRIES_NAV: NavItem[] = CHAOTANG_V1_LIUBU
  .filter((item) => item.href)
  .map((item) => ({ key: item.code, label: item.name, href: item.href! }));

/** 二级"专署"菜单:专门机构,不再归入六部。 */
export const COURT_OFFICES_NAV: NavItem[] = CHAOTANG_V1_ZHUANSHU.map((item) => ({
  key: item.code,
  label: item.name,
  href: item.href,
}));

/** 兼容旧引用:核心 + 六部 + 专署的全集。 */
export const DEPT_NAV: NavItem[] = [...SIX_MINISTRIES_NAV, ...COURT_OFFICES_NAV];
export const TOPNAV_ITEMS: NavItem[] = [...CORE_NAV, ...DEPT_NAV];

/**
 * 当前页 key — 保留导出供老代码引用。
 * 新代码不再依赖此常量(ChaotangTopNav 已改用 usePathname 自感知)。
 */
export const ACTIVE_NAV_KEY = 'study';

/** 快捷旨意（点击填入下旨框） */
export const FAST_DECREES: string[] = [
  '查江南赈灾粮拨付明细',
  '让户部测算盐茶盈余',
  '召六部会审赈灾方案',
  '拟一份竞品对比奏折',
  '看本月现金流风险',
];
