import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./final-release-harness.mjs', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/app/(dashboard)/layout.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/features/shangshufang/ShangshufangPage.tsx', import.meta.url), 'utf8');

test('资源阁与移动端发布检查使用首发上书房，不回退到已退役页面', () => {
  const checked = source.slice(source.indexOf('async function checkResourceGallery'));
  assert.match(checked, /\/shangshufang/);
  assert.doesNotMatch(checked, /\/court-briefing/);
});

test('全局顶栏资源按钮与上书房现有 ResourceGallery 完成接线', () => {
  assert.match(layout, /onOpenResources=/);
  assert.match(layout, /courtos:open-resources/);
  assert.match(page, /courtos:open-resources/);
  assert.match(page, /setResourceOpen\(true\)/);
});

test('严格鉴权环境允许注入真实测试会话 token', () => {
  assert.match(source, /process\.env\.HARNESS_AUTH_TOKEN/);
});
