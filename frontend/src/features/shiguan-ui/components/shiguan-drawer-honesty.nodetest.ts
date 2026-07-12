import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./ShiguanDrawer.tsx', import.meta.url), 'utf8');

test('史馆说明不把静态样例包装成今日真实史册', () => {
  assert.doesNotMatch(source, /drawerEvents|drawerDecisions|drawerAISummary|drawerKnowledge/);
  assert.match(source, /尚未接入真实归档写入/);
  assert.doesNotMatch(source, /生成奏折并归档/);
});
