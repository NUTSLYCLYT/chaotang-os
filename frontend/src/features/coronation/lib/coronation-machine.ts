/**
 * 登基门槛 · 「下旨 → 满朝回奏」真状态机(CORONATION_SPEC §1.3 + §2 保真契约)
 *
 * 桩①:封神那一秒的状态机。可假数据【内容】,不假状态【真实性】——
 * 成功 / 慢 / 失败 / 谏言 都是真实分支,失败和慢必须诚实演出,不许跳过。
 * 接入真后端时:每个 MinisterState 由一个真实 agent 状态驱动(保真率=1)。
 */

import type { Provenance } from './provenance';

export type MinisterId = 'chancellor' | 'hubu' | 'bingbu' | 'jinyiwei' | 'junjichu';

/** 大臣可见态 —— 每个都必须映射一个真实 agent 状态(§2 保真契约) */
export type MinisterState =
  | 'asleep' // 未就位 / agent 未激活
  | 'waking' // 苏醒 / agent 被这道旨激活
  | 'thinking' // 思考 / agent 在跑(检索·推理)
  | 'reporting' // 回奏 / agent 产出结论
  | 'remonstrating' // 谏言出列 / agent 给把关·异见
  | 'slow' // 告退去查、半晌方回 / agent 真在长任务(诚实演出慢)
  | 'silent_failed'; // 臣办不成 / agent 失败·查无·低置信(诚实演出,不许跳过)

export interface Minister {
  id: MinisterId;
  name: string; // 户部 / 兵部 …
  agentCode: string; // 真实映射的 agent 能力码(角色 ↔ 能力,§2)
  state: MinisterState;
  /** 该可见态是否由真实 agent 驱动;原型恒为 demo */
  provenance: Provenance;
  line?: string; // 回奏 / 谏言内容
}

export type CoronationPhase =
  | 'empty_hall' // 空殿(占有感先于能力感)
  | 'decree_issued' // 用户下了第一道旨
  | 'court_waking' // 群臣依次苏醒(因果链 = aspiration 点火)
  | 'deliberating' // 满朝议事
  | 'reported'; // 回奏完成(峰终:给一个属于他自己的具体结果)

export interface CoronationState {
  phase: CoronationPhase;
  decree: string | null;
  ministers: Minister[];
  /** 整段体验的数据来源;原型恒为 demo,封神不靠骗 */
  provenance: Provenance;
}

export type CoronationEvent =
  | { type: 'ISSUE_DECREE'; decree: string }
  | { type: 'WAKE'; id: MinisterId }
  | { type: 'THINK'; id: MinisterId }
  | { type: 'REPORT'; id: MinisterId; line: string }
  | { type: 'REMONSTRATE'; id: MinisterId; line: string }
  | { type: 'SLOW'; id: MinisterId }
  | { type: 'FAIL'; id: MinisterId; line: string }
  | { type: 'SETTLE' }
  | { type: 'RESET' };

export const INITIAL_MINISTERS: readonly Minister[] = [
  { id: 'chancellor', name: '丞相', agentCode: 'ZX', state: 'asleep', provenance: 'demo' },
  { id: 'hubu', name: '户部', agentCode: 'HB', state: 'asleep', provenance: 'demo' },
  { id: 'bingbu', name: '兵部', agentCode: 'BB', state: 'asleep', provenance: 'demo' },
  { id: 'jinyiwei', name: '锦衣卫', agentCode: 'JYW', state: 'asleep', provenance: 'demo' },
  { id: 'junjichu', name: '军机处', agentCode: 'JJC', state: 'asleep', provenance: 'demo' },
];

export function initialCoronationState(): CoronationState {
  return {
    phase: 'empty_hall',
    decree: null,
    ministers: INITIAL_MINISTERS.map((m) => ({ ...m })),
    provenance: 'demo',
  };
}

function patchMinister(
  ministers: readonly Minister[],
  id: MinisterId,
  patch: Partial<Minister>,
): Minister[] {
  return ministers.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

/** 不可变转移(coding-style: 永不原地改) */
export function coronationReducer(
  state: CoronationState,
  event: CoronationEvent,
): CoronationState {
  switch (event.type) {
    case 'ISSUE_DECREE':
      return { ...state, phase: 'decree_issued', decree: event.decree };
    case 'WAKE':
      return {
        ...state,
        phase: 'court_waking',
        ministers: patchMinister(state.ministers, event.id, { state: 'waking' }),
      };
    case 'THINK':
      return {
        ...state,
        phase: 'deliberating',
        ministers: patchMinister(state.ministers, event.id, { state: 'thinking' }),
      };
    case 'REPORT':
      return {
        ...state,
        ministers: patchMinister(state.ministers, event.id, {
          state: 'reporting',
          line: event.line,
        }),
      };
    case 'REMONSTRATE':
      return {
        ...state,
        ministers: patchMinister(state.ministers, event.id, {
          state: 'remonstrating',
          line: event.line,
        }),
      };
    case 'SLOW':
      return {
        ...state,
        ministers: patchMinister(state.ministers, event.id, { state: 'slow' }),
      };
    case 'FAIL':
      return {
        ...state,
        ministers: patchMinister(state.ministers, event.id, {
          state: 'silent_failed',
          line: event.line,
        }),
      };
    case 'SETTLE':
      return { ...state, phase: 'reported' };
    case 'RESET':
      return initialCoronationState();
    default:
      return state;
  }
}
