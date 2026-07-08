/**
 * Demo 时间线 · 「脚本化但状态为真」(CORONATION_SPEC §2)
 *
 * 可假数据【内容】(下面的台词是预设的),不假状态【真实性】:
 * 这条线里**真的**包含一次谏官出列、一次诚实演出的"慢"、一次诚实的回奏链。
 * 接真后端时:把这张静态时间线换成真实 agent 事件流,状态分支不变。
 */

import type { CoronationEvent } from './coronation-machine';

export interface ScenarioStep {
  /** 相对开场的毫秒数 */
  atMs: number;
  event: CoronationEvent;
}

/** 开局示例旨意(降低冷启动,SPEC §1.3) */
export const SAMPLE_DECREES: readonly string[] = [
  '这个月想冲营收,要不要压价清库存抢市场?',
  '帮我看看本周最该跟进哪个客户。',
  '查一下竞品最近有没有降价。',
];

/**
 * 因果链:丞相先醒 → 户部/兵部被点起思考 → 锦衣卫诚实"慢" →
 * 户部回奏 → 兵部【谏官出列反对】→ 锦衣卫迟到回奏 → 峰终。
 * 火力压在 t≈600ms 首字回奏(SPEC:<1.5s)。
 */
export const DEMO_SCENARIO: readonly ScenarioStep[] = [
  { atMs: 0, event: { type: 'WAKE', id: 'chancellor' } },
  { atMs: 250, event: { type: 'WAKE', id: 'hubu' } },
  { atMs: 250, event: { type: 'WAKE', id: 'bingbu' } },
  { atMs: 450, event: { type: 'WAKE', id: 'jinyiwei' } },
  { atMs: 550, event: { type: 'THINK', id: 'hubu' } },
  { atMs: 550, event: { type: 'THINK', id: 'bingbu' } },
  { atMs: 700, event: { type: 'SLOW', id: 'jinyiwei' } }, // 诚实演出:锦衣卫告退去查
  {
    atMs: 900,
    event: { type: 'REPORT', id: 'hubu', line: '毛利率已逼近安全线,压价空间仅 3 个点。' },
  },
  {
    atMs: 1500,
    event: {
      type: 'REMONSTRATE',
      id: 'bingbu',
      line: '陛下,此举恐被竞品跟价反噬,臣斗胆请缓——可点开看臣凭何而言。',
    },
  },
  {
    atMs: 3200,
    event: { type: 'REPORT', id: 'jinyiwei', line: '探得两家竞品上周已悄然降价 5%。' },
  },
  { atMs: 3600, event: { type: 'SETTLE' } },
];

export const DEMO_SCENARIO_DURATION_MS = 3600;
