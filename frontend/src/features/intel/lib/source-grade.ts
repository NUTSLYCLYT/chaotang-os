/**
 * 锦衣卫 · 情报来源等级判定（2026-07-05 · 会审 CRITICAL 修复后抽出）
 *
 * 背景：默认筛选改成「真实来源」后，会审发现真实 Turso 数据永远算不出 real → 地图空屏。
 * 根因：`/api/court/intel/signals` 的 rowToSignal 把真实行的 credibility 硬编码成 'medium'（后端桩，
 * schema 尚无该列）。因此**不能拿 credibility 判来源真伪**，否则真实数据全落 mixed、默认 real 空屏。
 *
 * 口径：真主库（turso）来的即「真实来源」；仅明确 low 可信才降 mixed；降级样例才是 fallback。
 * 待后端真填 credibility 后，可在此把 medium 也纳入 mixed 细分。
 */
import type { IntelSignal } from '@/lib/contracts/intel';

export type SourceGrade = 'all' | 'real' | 'mixed' | 'fallback';

export function sourceGrade(signal: IntelSignal, pageSource: 'turso' | 'fallback'): SourceGrade {
  if (pageSource === 'fallback') return 'fallback';
  if (signal.credibility === 'low') return 'mixed';
  return 'real';
}
