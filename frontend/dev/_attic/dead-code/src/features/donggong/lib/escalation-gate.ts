/**
 * 东宫 · 升级超时裁决（改造② · 大神会审 2026-06-03 · 堵 defaultOnTimeout 后门）
 *
 * 大神红线（芒格点名）：皇帝不回、SLA 到 → 默批 = 把"不作为"变成"批准"，
 * 且可被"把高危动作伪装成信息类"绕过。
 * 修正：超时【永不】默批高危/不可逆；默批只允许"真·只读信息类 + 独立分类校验"。
 *
 * 同 改造①：放 feature 层包住契约纯判定（`isEscalationOverdue`），不改契约 SoT。
 * 约定：运行期超时裁决一律调本函数，不要直接采信 `esc.defaultOnTimeout`。
 * 见 docs/东宫-人机权力边界-会审与北极星.md。
 */

import {
  isEscalationOverdue,
  type Escalation,
  type AuthVerdict,
} from '@/lib/contracts/authorization';
import type { RiskLevel } from '@/lib/contracts/agent';

export interface TimeoutResolveOpts {
  /**
   * 该动作经【独立分类器】校验确为只读信息类（来源 ≠ 请求方自报）。默认 false。
   * 只有 true 时，超时才允许回落到 esc.defaultOnTimeout（含 approve）。
   */
  verifiedReadOnlyInfo?: boolean;
}

/**
 * 升级到期时的【生效】裁决。
 *   未到期 → null（无需动作）。
 *   到期 + 高危/critical → 'escalate'（强制再上报 / 保持待裁，绝不 approve）。
 *   到期 + 非"独立校验的只读信息类" → 'escalate'（默认不放行，堵伪装后门）。
 *   到期 + 真·只读信息类 → 回落 esc.defaultOnTimeout（此处允许其配置，含 approve）。
 */
export function resolveTimeoutVerdict(
  esc: Escalation,
  risk: RiskLevel,
  nowEpoch: number,
  createdEpoch: number,
  opts: TimeoutResolveOpts = {},
): AuthVerdict | null {
  if (!isEscalationOverdue(esc, nowEpoch, createdEpoch)) return null;
  const highRisk = risk === 'high' || risk === 'critical';
  // 高危/不可逆，或非"独立校验过的只读信息类" → 绝不默批，强制升级待裁。
  if (highRisk || !opts.verifiedReadOnlyInfo) return 'escalate';
  // 真·只读信息类：允许回落契约配置的默认裁决。
  return esc.defaultOnTimeout;
}
