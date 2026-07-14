import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getV1LiubuByCanonicalCode } from '../../../config/chaotang-v1-modules.ts';

const relationship = readFileSync(new URL('./relationship-ledger-tab.tsx', import.meta.url), 'utf8');
const traffic = readFileSync(new URL('./traffic-growth-tab.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../departments/components/DepartmentPageViewShell.tsx', import.meta.url), 'utf8');

test('礼部 canonical route 接入真工作台', () => {
  const rites = getV1LiubuByCanonicalCode('market');
  assert.deepEqual(
    rites && { code: rites.code, canonicalCode: rites.canonicalCode, href: rites.href, status: rites.status },
    { code: 'libu_rites', canonicalCode: 'market', href: '/liubu/libu_rites', status: 'active' },
  );
  assert.match(shell, /currentView\.department\.code === 'market'/);
  assert.match(shell, /<LifuOfficeDesk \/>/);
});

test('礼部多列录入表在手机上先切为单列', () => {
  assert.match(relationship, /grid-cols-1[\s\S]*md:grid-cols-\[1\.3fr_0\.9fr_0\.9fr_1fr_1\.3fr_auto\]/);
  assert.match(traffic, /grid-cols-1[\s\S]*md:grid-cols-\[1\.1fr_0\.9fr_0\.9fr_0\.9fr_0\.9fr_auto\]/);
});
