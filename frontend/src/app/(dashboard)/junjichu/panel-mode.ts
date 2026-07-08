// src/app/(dashboard)/command-center/panel-mode.ts
// 面板诚实徽章的纯判据(从 page.tsx 抽出，可单测)。
// 铁律4：绿 LIVE 徽给结果加"定论/实时"视觉权重 —— 只有真 live 源配绿，
// 不实源(FALLBACK/MIXED/DEMO)有数据也只能标黄 FALLBACK，禁漂白成绿。
import type { SourceLabel } from '@/core/courtos/types';
import { isLiveLike } from '@/core/courtos/source-label';

/**
 *   - LIVE    ：绑定 taskId、已拿到真数据、且来源确为 live 链路 → 绿。
 *   - FALLBACK：绑定 taskId、有数据，但来源为回退/混合/演示 → 黄，禁冒充绿。
 *   - PENDING ：绑定 taskId 但作战流尚未回写本面板数据 → 「待回写」。
 *   - DEMO    ：未绑定 taskId → 演示骨架。
 */
export type PanelMode = 'LIVE' | 'FALLBACK' | 'PENDING' | 'DEMO';

/**
 * @param sourceLabel 真来源标；缺省(面板未透传)时维持既有行为按 LIVE 处理，
 *   但凡透传了非 live-like 的真标，一律降级为 FALLBACK(铁律4 去漂白)。
 */
export function resolvePanelMode(
  hasTask: boolean,
  hasData: boolean,
  sourceLabel?: SourceLabel | null,
): PanelMode {
  if (!hasTask) return 'DEMO';
  if (!hasData) return 'PENDING';
  if (sourceLabel && !isLiveLike(sourceLabel)) return 'FALLBACK';
  return 'LIVE';
}
