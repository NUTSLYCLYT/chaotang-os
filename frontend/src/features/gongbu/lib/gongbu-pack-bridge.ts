/**
 * gongbu-pack-bridge —— 工部对接后端 PACK 蜂群(铁律6:产线一个出口 / 铁律9:产线留后端)。
 *
 * 不新建工部专用 fetch:经唯一桥 `CourtLiveSwarmAdapter`(依赖注入,prod 传 jiqun adapter,
 * 测试传 stub),把 pack_rd sizing 任务派给后端真蜂群。pack_rd 真算在后端,本 bridge 只
 * 「打包请求 + 转发 + 映射结果」,前端零产线计算。
 *
 * 诚实:sourceLabel 取自 adapter 真实回执(LIVE_SWARM / FALLBACK),不伪造;adapter down/未配
 * 一律 FALLBACK,绝不假装算过。
 */

import type { SourceLabel } from '@/core/courtos/types';
import type {
  CourtLiveSwarmAdapter,
  CourtLiveAdapterDispatchInput,
} from '@/core/courtos/runtime/live-swarm-adapter';
import type { BatteryCell } from './battery-products';

export interface PackSizingRequest {
  taskId: string;
  /** 工程需求(电压/容量/温度/场景)。 */
  requirement: string;
  /** 工部底座初筛的候选电芯(battery-products 选型,作蜂群输入上下文)。 */
  candidateCells?: BatteryCell[];
  userId?: string;
}

export interface PackSizingOutcome {
  ok: boolean;
  /** 取自后端蜂群回执;adapter 不可达=FALLBACK(诚实)。 */
  sourceLabel: SourceLabel;
  /** 后端蜂群产出的用户可见摘要(后端算,前端不改)。 */
  summary: string;
  findings: string[];
  /** 蜂群缺的能力(如后端未接 pack_rd)。 */
  missingCapabilities: string[];
}

/** 把候选电芯压成蜂群可读的一句上下文(脱敏:仅型号/参数,不含敏感)。 */
function cellsContext(cells?: BatteryCell[]): string {
  if (!cells || cells.length === 0) return '';
  return ` 候选电芯:${cells.map((c) => `${c.model}(${c.capacity}/${c.tempRange})`).join('、')}`;
}

/**
 * 经唯一 live-swarm-adapter 把 PACK sizing 派给后端蜂群。
 * @param adapter 注入的蜂群桥(prod=jiqun;禁在此 new fetch)
 */
export async function dispatchPackSizing(
  adapter: CourtLiveSwarmAdapter,
  req: PackSizingRequest,
): Promise<PackSizingOutcome> {
  const input: CourtLiveAdapterDispatchInput = {
    task_id: req.taskId,
    original_question: `${req.requirement}${cellsContext(req.candidateCells)}`,
    selected_departments: ['gong_bu'],
    swarm_bundles: ['pack_rd'],
    source_label: 'LIVE_SWARM', // 意图;实际以回执为准
    user_id: req.userId,
  };

  try {
    const r = await adapter.dispatch(input);
    return {
      ok: r.ok,
      sourceLabel: r.source_label, // 诚实:用后端回执的真实标
      summary: r.user_visible_summary,
      findings: r.findings,
      missingCapabilities: r.missing_capabilities,
    };
  } catch {
    // adapter 异常/不可达 → 诚实降级,绝不假装算过
    return {
      ok: false,
      sourceLabel: 'FALLBACK',
      summary: '后端 PACK 蜂群不可达,本次未出真 sizing(降级)。请稍后重试或人工核算。',
      findings: [],
      missingCapabilities: ['pack_rd'],
    };
  }
}
