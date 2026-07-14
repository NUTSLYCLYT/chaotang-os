/**
 * 首发白名单 · 默认拒绝（2026-06-28 · 张小龙天才建议落地）
 *
 * 上线论点：商家点的每一条路都必须是真的。与其逐个砍 demo 页（黑名单永远漏），
 * 不如反过来——只放行「首发真业务面 + 启动流」，其余页面生产环境一律 redirect→上书房。
 * 漏一个也只是少露一个真面，绝不会把假门暴露给商家。
 *
 * 受众：仅商家/老板（2026-06-28 决策）。jiqun 后台/task/admin/settings/翰林/庄园/东宫/
 * 治理/原型/路演 全部不对外。
 *
 * 纯函数 · 由 src/middleware.ts 在生产环境消费（NODE_ENV=production && RETIRE_SURFACES!==0）。
 * 回归断言见 launch-whitelist.nodetest.ts（铁律4：高危改动钉一条断言）。
 *
 * routePath 不含 BASE_PATH（middleware 已剥离）。
 */

import { getLaunchEnvironment } from './launch-governance.ts';

/**
 * 首发放行的页面前缀 —— 2026-07-08 v1 极简脊柱（张小龙：一入口一条路）。
 *
 * 上线战略：集中兵力打一个点，第一周只让老板看见**一条杀手 loop**：
 *   上传真决策(上书房) → 六部蜂群审 → 军机处会审 → 准奏/驳回 → 史馆归档。
 * 六部审是 loop 内部的蜂群结果（在上书房/军机处呈现），**不是**让老板逐个点 /departments。
 * 其余面（情报/庄园/钦天监/翰林/太医/官印/专署/原型…）代码不删，运行时 redirect→上书房，
 * 拿到第一个真实客户反馈后再按需解冻。放开某面前先答铁律5：它的第一条真实数据从哪来？
 */
export const LAUNCH_ALLOWED_PREFIXES: readonly string[] = [
  '/dadian',
  '/shangshufang',
  '/junjichu',
  '/liubu',
  '/zhuanshu',
  '/shiguan',
  '/intro',
  '/enter',
  '/onboarding',
  '/login',
  '/register',
  '/invite',
];

/** 部门：v1 极简脊柱不放行任何 /departments 详情——六部审在上书房/军机处内以蜂群结果呈现，
 *  不让老板逐个点部门稀释信号。拿到首个真实客户反馈后再按需解冻（铁律5）。 */
export const LAUNCH_ALLOWED_DEPARTMENTS: readonly string[] = [];

/** INTERNAL 环境专属面(FULL_COURT 2026-07-14 裁决:非刑部能力默认 INTERNAL/SHADOW)。
 *  对外生产(demo/pilot)仍 redirect;COURTOS_LAUNCH_MODE=internal 时放行。
 *  翰林院的铁律5答案:第一条真实数据 = truth_ledger 确定性判定(P9 已接通)。 */
export const INTERNAL_ONLY_PREFIXES: readonly string[] = ['/hanlin'];

/** 非页面路由（API / 后端代理 / 静态资源）——永不参与首发 redirect。 */
const NON_PAGE_PREFIXES: readonly string[] = [
  '/api/',
  '/jiqun/api/',
  '/_next',
  '/assets',
  '/fonts',
  '/heroes',
  '/favicon',
];

/**
 * 静态资源文件扩展名——永不 redirect。按扩展名豁免(而非按前缀)，
 * 这样 public/ 下任意目录的图/字体/媒体(如 /prd/*.webp)都放行，
 * 又不会误放 /prd/[space] 这类「同名前缀但是页面」的路由(页面无文件扩展名)。
 */
const STATIC_ASSET_RE = /\.(webp|png|jpe?g|gif|svg|ico|avif|woff2?|ttf|otf|mp4|webm|json|txt|xml|map)$/i;

function matchesPrefix(routePath: string, prefix: string): boolean {
  return routePath === prefix || routePath.startsWith(prefix + '/');
}

/** 该页面是否在首发白名单内（true = 放行）。 */
export function isLaunchAllowedPage(routePath: string): boolean {
  if (routePath === '/') return true; // 根 → /intro

  // legacy departments surface stays retired; v1 uses /liubu.
  if (routePath === '/departments' || routePath.startsWith('/departments/')) return false;

  if (LAUNCH_ALLOWED_PREFIXES.some((p) => matchesPrefix(routePath, p))) return true;

  // INTERNAL/SHADOW 面:仅 internal 环境放行,对外生产不暴露
  if (INTERNAL_ONLY_PREFIXES.some((p) => matchesPrefix(routePath, p))) {
    return getLaunchEnvironment() === 'internal';
  }
  return false;
}

/**
 * 生产首发是否应把该路由 redirect 到上书房。
 * 仅对「页面路由」生效：API / 后端代理 / 静态资源一律放过（return false）。
 */
export function shouldRedirectForLaunch(routePath: string): boolean {
  // 非页面路由（含 /jiqun/api/ 后端代理）永不 redirect，否则会打断所有数据请求。
  if (NON_PAGE_PREFIXES.some((p) => routePath === p || routePath.startsWith(p))) {
    return false;
  }
  // 静态资源(按扩展名)永不 redirect：修 /prd/*.webp 等被当页面 307 跳走 → 商家见裂图。
  if (STATIC_ASSET_RE.test(routePath)) {
    return false;
  }
  return !isLaunchAllowedPage(routePath);
}
