import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isLaunchAllowedPage,
  shouldRedirectForLaunch,
} from './launch-whitelist.ts';

// 铁律4 回归：上线首日，商家点进去必须是真的。
// 2026-07-08 v1 收窄为「极简脊柱」——只放行一条杀手 loop + 启动流，其余全 redirect→上书房。
// "脊柱放行" + "其余（含曾经放行的情报/庄园/六部…）挡住" 钉成断言，防有人手滑放出半成品面。

test('杀手 loop 脊柱放行（上传→审→准奏→归档）', () => {
  for (const p of [
    '/dadian',
    '/shangshufang',
    '/shangshufang/anything',
    '/junjichu',
    '/liubu',
    '/liubu/hubu',
    '/liubu/hubu/yusuan',
    '/zhuanshu',
    '/zhuanshu/jinyiwei',
    '/shiguan',
    '/shiguan/case-123',
  ]) {
    assert.equal(isLaunchAllowedPage(p), true, `${p} 应放行`);
    assert.equal(shouldRedirectForLaunch(p), false, `${p} 不该 redirect`);
  }
});

test('启动流/认证放行（首日要能登录进来）', () => {
  for (const p of ['/', '/intro', '/enter', '/onboarding', '/login', '/register', '/invite']) {
    assert.equal(shouldRedirectForLaunch(p), false, `${p} 不该 redirect`);
  }
});

test('v1 脊柱外的面一律挡住（曾放行的情报/庄园/专署/原型…本轮收窄）', () => {
  for (const p of [
    '/intel', // 锦衣卫情报 —— 解冻待第一条真实反馈
    '/intel/sig-123',
    '/manors',
    '/overview',
    '/court-briefing',
    '/command-center',
    '/archive',
    '/archive/case-123',
    '/forecast',
    '/hanlin',
    '/health',
    '/libu',
    '/seals',
    '/power',
    '/depts',
    '/court',
    '/donggong',
    '/offices',
    '/shangshufang-prototypes',
    '/status',
    '/about',
    '/guide',
    '/more',
    '/start',
    '/share/verdict',
  ]) {
    assert.equal(shouldRedirectForLaunch(p), true, `${p} v1 脊柱外，应 redirect`);
  }
});

test('六部详情一律挡住（六部审在上书房/军机处内呈现，不逐个点部门）', () => {
  for (const p of [
    '/departments',
    '/departments/finance',
    '/departments/ops',
    '/departments/legal',
    '/departments/gongbu',
    '/departments/unknown_dept',
  ]) {
    assert.equal(shouldRedirectForLaunch(p), true, `${p} v1 不放行，应 redirect`);
  }
});

test('demo/内部页一律挡住（点金光见假的债，焊死）', () => {
  for (const p of [
    '/governance',
    '/study/finance',
    '/demo',
    '/jiqun/runs', // jiqun 后台页（仅商家上线，不对外）
    '/admin',
    '/settings',
    '/present/123',
    '/prototype/boss-decision-loop',
  ]) {
    assert.equal(shouldRedirectForLaunch(p), true, `${p} 应被 redirect`);
  }
});

test('API / 后端代理 / 静态资源永不 redirect（否则打断所有数据请求）', () => {
  for (const p of [
    '/api/court/intel/signals',
    '/api/auth/local-login',
    '/jiqun/api/runs', // 后端代理：必须放过
    '/_next/static/chunk.js',
    '/fonts/noto.woff2',
    '/assets/logo.svg',
  ]) {
    assert.equal(shouldRedirectForLaunch(p), false, `${p} 不该 redirect（非页面路由）`);
  }
});

// 铁律4 回归：2026-06-28 harness:release 实测抓出资源画廊 10 张坏图，
// 根因=白名单按前缀豁免，漏了 public/prd/*.webp（/prd 不在 NON_PAGE_PREFIXES）→ 被当页面 307 跳走 → 商家见裂图。
// 修法=按静态资源扩展名豁免。钉死：/prd/*.webp 等放行，但同名前缀的页面路由 /prd/[space] 仍挡住。
test('静态资源按扩展名永不 redirect（修资源画廊裂图，含 /prd/*.webp）', () => {
  for (const p of [
    '/prd/01-shangshufang.webp',
    '/prd/09-taiyi.webp',
    '/heroes/v4-1-zhuge.webp',
    '/assets/hubu/scene-full.webp',
    '/icon.png',
    '/og.jpg',
  ]) {
    assert.equal(shouldRedirectForLaunch(p), false, `${p} 静态资源不该 redirect`);
  }
});

test('同名前缀的页面路由仍被挡（/prd/[space] 是内部页，不能因静态豁免而暴露）', () => {
  // /prd/somespace 无文件扩展名 → 仍走页面白名单 → 内部页应 redirect。
  assert.equal(shouldRedirectForLaunch('/prd/finance-space'), true, '/prd/[space] 页应被 redirect');
});
