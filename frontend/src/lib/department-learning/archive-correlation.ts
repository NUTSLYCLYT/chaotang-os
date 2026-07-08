/**
 * taskId 关联判定(2026-07-03 会审HIGH修复 · 纯函数，零 server-only 依赖)。
 *
 * 根因：archive-backfill.ts 此前判断"归档是否确认"只查"任意归档是否存在于表里"
 * (hasCourtArchive(archiveId))，不问它是不是这条老板签核真正在等的那次归档——导致陈旧
 * pending 签核被任何不相关的新归档事件误配对、反复计入 verdict-threshold.ts 的累计样本
 * (以为攒够3个独立真实样本，实为同一件事被算了3次)。
 *
 * 单独成文件的原因：real-source.ts 顶层 import archive-store.ts(带 `import 'server-only'`)，
 * 裸 node/tsx 测试运行时一旦 import real-source.ts 的任何一个具名导出，整个模块(含其
 * 顶层的 server-only import)都会被执行而报错——独立会审曾建议"直接测
 * applyDepartmentLearningRealSource"，经验证确实过不了这道墙。抽到这个零依赖文件，
 * real-source.ts 只管 DB 读写 + 调用这段纯判定，判定本身才能被 nodetest 真行为断言钉住。
 */
export function resolveArchiveConfirmation(input: {
  outcomeTaskId: string | null;
  expectedTaskId: string | undefined;
  archiveExists: boolean;
}): { archiveConfirmed: boolean; usedStrictCheck: boolean } {
  if (input.outcomeTaskId && input.expectedTaskId) {
    return { archiveConfirmed: input.outcomeTaskId === input.expectedTaskId && input.archiveExists, usedStrictCheck: true };
  }
  return { archiveConfirmed: input.archiveExists, usedStrictCheck: false };
}
