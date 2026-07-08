import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveSwarmAdapter, currentRolloutStage } from './live-swarm-adapter-factory.ts';

/**
 * 铁律4 回归（gated live swarm adapter 工厂 + 升级闸）：
 * 钉死 ①默认 jiqun 行为不变 ②非 jiqun 受 rollout 闸约束、未到 stage 返 disabled 带原因
 * ③到 stage 但未接线仍 disabled、不静默回落 jiqun（不静默换通路）④非法 id 回退 jiqun。
 * 会咬：把工厂换回硬编码 createJiqunLiveSwarmAdapter→②③④ 红；闸去掉→②红。
 */

function withEnv(over: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const keys = ['LIVE_SWARM_ADAPTER_ID', 'ROLLOUT_STAGE'];
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) prev[k] = process.env[k];
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
}

test('默认（无 env）→ jiqun adapter，行为与改造前一致', async () => {
  await withEnv({ LIVE_SWARM_ADAPTER_ID: undefined, ROLLOUT_STAGE: undefined }, async () => {
    const a = createLiveSwarmAdapter();
    assert.equal(a.id, 'jiqun');
    const cap = await a.capability();
    assert.equal(cap.state, 'ready', 'jiqun min stage 0，默认可用');
  });
});

test('openclaw 在 stage<3 → disabled（升级闸拦住，原因含 rollout stage）', async () => {
  await withEnv({ LIVE_SWARM_ADAPTER_ID: 'openclaw', ROLLOUT_STAGE: undefined }, async () => {
    const a = createLiveSwarmAdapter();
    assert.equal(a.id, 'openclaw', '不静默换成 jiqun');
    const cap = await a.capability();
    assert.equal(cap.state, 'disabled');
    assert.match(cap.user_visible_summary, /rollout stage/);
  });
});

test('openclaw 到 stage 3 但未接线 → 仍 disabled（slot not wired），不静默回落 jiqun', async () => {
  await withEnv({ LIVE_SWARM_ADAPTER_ID: 'openclaw', ROLLOUT_STAGE: '3' }, async () => {
    const a = createLiveSwarmAdapter();
    assert.equal(a.id, 'openclaw');
    const cap = await a.capability();
    assert.equal(cap.state, 'disabled');
    assert.match(cap.user_visible_summary, /未接线|not wired/);
  });
});

test('hermes 需 stage 4：stage 3→stage 闸拦，stage 4→未接线', async () => {
  await withEnv({ LIVE_SWARM_ADAPTER_ID: 'hermes', ROLLOUT_STAGE: '3' }, async () => {
    const cap = await createLiveSwarmAdapter().capability();
    assert.equal(cap.state, 'disabled');
    assert.match(cap.user_visible_summary, /rollout stage/);
  });
  await withEnv({ LIVE_SWARM_ADAPTER_ID: 'hermes', ROLLOUT_STAGE: '4' }, async () => {
    const cap = await createLiveSwarmAdapter().capability();
    assert.equal(cap.state, 'disabled');
    assert.match(cap.user_visible_summary, /未接线|not wired/);
  });
});

test('非法 adapter id → 回退 jiqun', async () => {
  await withEnv({ LIVE_SWARM_ADAPTER_ID: 'bogus', ROLLOUT_STAGE: undefined }, async () => {
    assert.equal(createLiveSwarmAdapter().id, 'jiqun');
  });
  // 显式传参覆盖 env
  await withEnv({ LIVE_SWARM_ADAPTER_ID: 'openclaw', ROLLOUT_STAGE: undefined }, async () => {
    assert.equal(createLiveSwarmAdapter('jiqun').id, 'jiqun', '显式传参优先于 env');
  });
});

test('currentRolloutStage：默认 1、非法→1、合法解析', async () => {
  await withEnv({ ROLLOUT_STAGE: undefined }, () => { assert.equal(currentRolloutStage(), 1); });
  await withEnv({ ROLLOUT_STAGE: 'abc' }, () => { assert.equal(currentRolloutStage(), 1); });
  await withEnv({ ROLLOUT_STAGE: '3' }, () => { assert.equal(currentRolloutStage(), 3); });
});
