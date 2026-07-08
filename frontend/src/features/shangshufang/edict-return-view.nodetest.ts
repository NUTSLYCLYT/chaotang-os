import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeEdictView, persistedEdictReturnToView } from './edict-return-view.ts';
import type { ShangshufangEdictReturn } from '../../lib/contracts/shangshufang.ts';

const wrap = (view: unknown) => ({ edictView: view }) as unknown as ShangshufangEdictReturn;

/**
 * 接缝往返断言(2026-06-20 会审欠的那块砖):证明 blastRadius 经
 * normalizeEdictView(POST 校验)→ persistedEdictReturnToView(回读渲染) 全程不被摔掉。
 * 我之前每层单元都对、却没测组装——这条钉死"5 层里没人再把判红信号丢在地上"。
 */
test('接缝往返:高危 blastRadius 经 normalize→persistedToView 全程保留', () => {
  const raw = {
    id: 'reconcile:t1:jiqun:s1',
    title: '蜂群回奏 · 质门阻塞',
    subtitle: 's1 · 质门阻塞',
    meta: {
      reporter: '蜂群',
      priority: 'high',
      blastRadius: 'irreversible',
      badges: [{ label: '质门阻塞', tone: 'red' }],
    },
    rows: [{ label: '所 议', body: '户部评估：三花智控当前仓位是否该减' }],
    seal: 'secret',
  };

  const persisted = normalizeEdictView(raw);
  assert.ok(persisted, 'normalizeEdictView 不应判非法');
  assert.equal(persisted.meta?.blastRadius, 'irreversible', 'normalize 必须保留 blastRadius');

  const rendered = persistedEdictReturnToView(wrap(persisted));
  assert.equal(rendered.meta?.blastRadius, 'irreversible', 'persistedToView 必须保留 blastRadius');
});

test('接缝往返:低危(无 blastRadius)保持 undefined,不崩、不臆造高危', () => {
  const raw = {
    id: 'reconcile:t2:jiqun:s2',
    title: '蜂群回奏',
    meta: { reporter: '蜂群', priority: 'medium' },
    rows: [{ label: '所 议', body: '帮我把奏折标题改短一点' }],
    seal: 'imperial',
  };

  const persisted = normalizeEdictView(raw);
  assert.ok(persisted);
  assert.equal(persisted.meta?.blastRadius, undefined);
  assert.equal(persistedEdictReturnToView(wrap(persisted)).meta?.blastRadius, undefined);
});

test('normalizeEdictView 拒非法(缺 id/title/rows/seal → null)', () => {
  assert.equal(normalizeEdictView({ title: '无 id' }), null);
  assert.equal(normalizeEdictView(null), null);
});
