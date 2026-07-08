/**
 * 东宫 · 全局自主执行总闸（改造① · 大神会审 2026-06-03）
 *
 * 为什么在 feature 层而非契约层：`lib/contracts/authorization.ts` 是类型契约 SoT，
 * 保持纯判定（execModeFor）；"现在到底允不允许自动执行"是【运行期/部署】开关，归 feature lib。
 * （契约自己的注释即："状态转移逻辑放 feature lib，契约只给判定"。）
 *
 * 默认【关】：env `DONGGONG_AUTONOMY_ENABLED !== 'true'` → 任何动作一律 `propose`，
 * 渐进授权状态机(graduated)冻结保留但不启用。
 *
 * 理由（会审共识，见 docs/东宫-人机权力边界-会审与北极星.md）：底层 LLM「大脑」尚未接通
 * （实测 rule/骨架兜底，见 tests/swarm-eval/FINDINGS.md）。能力未验证即谈自动执行 = 架构与
 * 能力的致命错配。接通大脑 + 单类目实测达标（conviction≥8 + 动作可逆）后，由后端按类目逐步打开。
 *
 * fail-safe：client 端 `process.env` 该变量为 undefined → 视为关 → 默认 `propose`。
 *
 * 约定：所有"该不该自动执行"的运行期判定**必须调本模块 `effectiveExecMode`，不要直接调
 * 契约的 `execModeFor`**（后者只是总闸开启后的纯判定）。
 */

import {
  execModeFor,
  type AuthorizationGrant,
  type ExecMode,
} from '@/lib/contracts/authorization';
import type { RiskLevel } from '@/lib/contracts/agent';

/** 自主执行总闸：默认关。需后端显式 `DONGGONG_AUTONOMY_ENABLED=true` 才放开。 */
export const AUTONOMY_ENABLED: boolean =
  process.env.DONGGONG_AUTONOMY_ENABLED === 'true';

/**
 * 运行期生效的执行模式。
 *   总闸【关】（默认）→ 一律 `propose`（只提案、待皇帝裁），绝不自动执行。
 *   总闸【开】        → 回落到契约纯判定 `execModeFor`（高危/未毕业仍 propose）。
 */
export function effectiveExecMode(
  grant: AuthorizationGrant,
  risk: RiskLevel,
): ExecMode {
  if (!AUTONOMY_ENABLED) return 'propose';
  return execModeFor(grant, risk);
}

/** 显式查询总闸态（供 UI 提示"自动执行未启用·全部待裁"等）。 */
export function isAutonomyEnabled(): boolean {
  return AUTONOMY_ENABLED;
}
