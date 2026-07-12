import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./DecreeInput.tsx', import.meta.url), 'utf8');

test('slot 模式御前操作行在手机宽度允许换行', () => {
  assert.match(source, /inSlot \? 'flex flex-wrap items-center gap-1\.5 sm:flex-nowrap'/);
});
