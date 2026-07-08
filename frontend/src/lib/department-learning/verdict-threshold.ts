import type { DepartmentLearningRecord } from '@/lib/contracts/department-learning';

/**
 * 样本量闸门(2026-07-03 P2修 · 会审驱动)——纯函数，零 DB/server-only 依赖，供
 * real-source.ts 复用、也供 nodetest 直接单测(archive-store.ts 的 server-only 标记会拖垮
 * 任何试图直接 import real-source.ts 的裸 node/tsx 测试，故把可测的判定逻辑单独抽出)。
 *
 * DEPARTMENT_LEARNING_FEED_DECISIONS 默认关时留下的真正根因——此前"最近一次事件直接覆盖
 * 判定"，一次签核+归档就能把某部门权重从中性甩到 1.15/0.5。这里改成：累计双证据样本数
 * < 阈值前，判定强制留 observing；过阈值后看累计多数票(confirmed vs refuted)而非只看
 * 最近一次事件，且打平(confirmed===refuted)时同样判 observing，不偏向任何一边。
 *
 * ✅ 已解决(2026-07-03 会审 HIGH → boss-ledger.ts 加 task_id 关联，见 archive-correlation.ts)：
 * 此前 boss_decisions 表没有存 task_id/archive_id 关联，pendingBossEvidence 只能靠 evidence
 * 数组里最早一条 'archive:pending' 标记(且从不清除)反复匹配——一个部门只要曾有过一次陈旧未
 * 归档的签核，之后任何不相关的新归档保存都会重新把它跟一个不相关的 archiveId 配对，判定为
 * "确认"，让同一条陈旧记录被反复计数。现已在 boss_decisions 加 task_id 列 + verifyEvidence
 * 严格比对，样本计数的独立性有了真凭据。
 *
 * 净胜局数(2026-07-03 P2追加·会审MEDIUM驱动)：光要求"多数"在小样本下几乎筛不掉噪声——
 * MIN_SAMPLES_FOR_VERDICT=3 是奇数，永远不可能打平(3只能分成2-1或3-0)，"打平判observing"这条
 * 防线在恰好3个样本时形同虚设：2-1这种勉强多数，在纯随机噪声(公平硬币)下发生概率是100%。
 * 改成要求"净胜局数"(|confirmedCount-refutedCount|)达到 MIN_MARGIN_FOR_VERDICT 才让判定偏离
 * observing——2-1(margin=1)不够，3-0(margin=3)才够；这直接把"公平硬币也能骗过去"的概率从
 * 100%压到25%(3局全同向才够)，且样本量不够继续攒，不会卡死在永远observing。
 */
export const MIN_SAMPLES_FOR_VERDICT = 3;
export const MIN_MARGIN_FOR_VERDICT = 2;

export interface ThresholdedVerdictResult {
  confirmedCount: number;
  refutedCount: number;
  verdict: DepartmentLearningRecord['verdict'];
}

/**
 * @param priorConfirmed 累计至今的 confirmed 样本数
 * @param priorRefuted 累计至今的 refuted 样本数
 * @param thisRoundOutcome 本轮事件的真实结果；null = 单证据(史馆未归档)，不计入累计
 */
export function deriveThresholdedVerdict(
  priorConfirmed: number,
  priorRefuted: number,
  thisRoundOutcome: 'confirmed' | 'refuted' | null,
): ThresholdedVerdictResult {
  const confirmedCount = thisRoundOutcome === 'confirmed' ? priorConfirmed + 1 : priorConfirmed;
  const refutedCount = thisRoundOutcome === 'refuted' ? priorRefuted + 1 : priorRefuted;
  const totalSamples = confirmedCount + refutedCount;
  const margin = Math.abs(confirmedCount - refutedCount);
  const belowThreshold = totalSamples < MIN_SAMPLES_FOR_VERDICT || margin < MIN_MARGIN_FOR_VERDICT;

  const verdict: DepartmentLearningRecord['verdict'] =
    thisRoundOutcome === null || belowThreshold
      ? 'observing'
      : confirmedCount > refutedCount
        ? 'confirmed'
        : 'refuted';

  return { confirmedCount, refutedCount, verdict };
}
