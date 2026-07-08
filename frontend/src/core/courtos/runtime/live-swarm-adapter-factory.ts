import type { CourtLiveAdapterId, CourtLiveSwarmAdapter } from './live-swarm-adapter.ts';
import { createDisabledLiveSwarmAdapter } from './live-swarm-adapter.ts';
import { createJiqunLiveSwarmAdapter } from './jiqun-live-swarm-adapter.ts';

/**
 * Live swarm adapter 工厂 + 升级闸（铁律3 消「swarm-deepen 硬编码 jiqun」+ 铁律13.2-9 堵直连红线）。
 *
 * 为什么要这层：
 * - 原 swarm-deepen/route.ts 硬编码 createJiqunLiveSwarmAdapter()。一旦有人要接 OpenClaw/Hermes，
 *   最省事的改法就是在那里手写 fetch :18789/:8644 ——这会让前端直连重型上游网关，违反引擎边界。
 * - 把「选哪个 adapter」收敛成一个带 rollout 闸的工厂：升级路径变成 env 切换，而不是改代码直连。
 *
 * 闸的语义（按 openclaw-hermes 使用设计的 5 阶段 rollout）：
 * - 每个 adapter 有最小 rollout stage；当前 ROLLOUT_STAGE 未到 → 返回 disabled adapter（带明确原因），
 *   **不静默回落 jiqun**（静默换通路会让用户以为走的是它选的引擎，违反诚实标源精神）。
 * - openclaw/hermes/legal_agent 当前都「未接线」，即便 stage 到了也返回 disabled，直到各自 adapter 真正实现。
 * - 默认 jiqun（min stage 0），所以不传参/不配 env 时行为与改造前完全一致。
 */

/** 各 adapter 解锁所需的最小 rollout stage。jiqun 始终可用；其余按 rollout 推进。 */
const ADAPTER_MIN_STAGE: Record<CourtLiveAdapterId, number> = {
  jiqun: 0,
  openclaw: 3, // Stage 3：需求拉动接 OpenClaw
  hermes: 4, // Stage 4：可选会诊网关
  legal_agent: 4,
};

const VALID_ADAPTER_IDS: readonly CourtLiveAdapterId[] = ['jiqun', 'openclaw', 'hermes', 'legal_agent'];

/** 读当前 rollout stage（env ROLLOUT_STAGE，默认 1=主闭环上线阶段）。非法值保守取 1。 */
export function currentRolloutStage(): number {
  const raw = process.env.ROLLOUT_STAGE;
  if (!raw) return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
}

function resolveAdapterId(adapterId?: string): CourtLiveAdapterId {
  const candidate = adapterId ?? process.env.LIVE_SWARM_ADAPTER_ID ?? 'jiqun';
  return (VALID_ADAPTER_IDS as readonly string[]).includes(candidate)
    ? (candidate as CourtLiveAdapterId)
    : 'jiqun';
}

/**
 * 选取 live swarm adapter。无参数=读 env LIVE_SWARM_ADAPTER_ID（默认 jiqun），行为与改造前一致。
 * 非 jiqun 适配器受 rollout 闸约束；未接线者一律返回 disabled（携明确原因，绝不静默换通路）。
 */
export function createLiveSwarmAdapter(adapterId?: string): CourtLiveSwarmAdapter {
  const id = resolveAdapterId(adapterId);
  const stage = currentRolloutStage();
  const minStage = ADAPTER_MIN_STAGE[id];

  if (stage < minStage) {
    return createDisabledLiveSwarmAdapter(
      id,
      `${id} adapter 未到 rollout stage（当前 ROLLOUT_STAGE=${stage}，需 ≥${minStage}）`,
    );
  }

  switch (id) {
    case 'jiqun':
      return createJiqunLiveSwarmAdapter();
    // openclaw/hermes/legal_agent 即便 stage 到达也尚未接线 —— 待各自 adapter 实现后在此接入，
    // 严禁在 swarm-deepen route 手写 fetch 直连上游（铁律13.2-9）。
    case 'openclaw':
    case 'hermes':
    case 'legal_agent':
      return createDisabledLiveSwarmAdapter(id, `${id} live adapter 尚未接线（slot not wired yet）`);
    default:
      return createJiqunLiveSwarmAdapter();
  }
}
