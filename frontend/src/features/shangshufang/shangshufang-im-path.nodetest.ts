import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./ShangshufangPage.tsx', import.meta.url), 'utf8');

test('上书房 IM 直连后端 canonical path，不再请求已退役的 court alias', () => {
  assert.match(source, /withBasePath\('\/api\/shangshufang\/im'\)/);
  assert.doesNotMatch(source, /['"]\/api\/court\/shangshufang\/im['"]/);
});
