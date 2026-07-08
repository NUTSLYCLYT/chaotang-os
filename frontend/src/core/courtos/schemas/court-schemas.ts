/**
 * CourtOS V1 契约 schema（任务书 §7）—— runtime 校验上书房/军机处各阶段产物。
 * 只依赖 zod（无 @/ 运行时依赖 → 可离线单测）。ZSourceLabel 是 SourceLabel 类型的运行时校验器
 * （同 contracts/schemas.ts 的 ZAgentCode 范式，不是平行 SSOT）。
 */
import { z } from 'zod';

export const ZSourceLabel = z.enum(['LIVE', 'LIVE_SWARM', 'MIXED', 'FALLBACK', 'DEMO']);
export const ZMinistrySignal = z.enum(['GREEN', 'YELLOW', 'RED', 'GRAY']);
export const ZMinistryVerdict = z.enum(['APPROVE', 'NEED_EVIDENCE', 'RECHECK', 'REJECT']);
export const ZEdictVerdictKind = z.enum(['准奏', '补证', '复核', '驳回']);

/** §7.1 DraftEdictV1 —— 丞相拟旨产物。 */
export const DraftEdictV1 = z.object({
  question: z.string().min(5),
  problemType: z.string(),
  expectedVerdictKinds: z.array(ZEdictVerdictKind),
  known: z.array(z.string()),
  gaps: z.array(z.string()),
  ministriesHint: z.array(z.string()),
  sourceLabel: ZSourceLabel,
});
export type DraftEdictV1 = z.infer<typeof DraftEdictV1>;

/** §7.2 ReviewPlanV1 —— 军机处会审计划（选部 + 理由）。 */
export const ReviewPlanV1 = z.object({
  selectedMinistries: z.array(z.string()).min(1),
  reasons: z.record(z.string(), z.string()),
  sourceLabel: ZSourceLabel,
});
export type ReviewPlanV1 = z.infer<typeof ReviewPlanV1>;

/** §7.3 MinistryOpinionV1 —— 单部红蓝裁断（= RedBlueCard 校验包装）。 */
export const MinistryOpinionV1 = z.object({
  ministryId: z.string(),
  signal: ZMinistrySignal,
  verdict: ZMinistryVerdict,
  mainThesis: z.string(),
  deputyChallenge: z.string(),
  missingEvidence: z.array(z.string()),
  conditionsToProceed: z.array(z.string()),
  needsHumanConfirmation: z.boolean(),
  sourceLabel: ZSourceLabel,
});
export type MinistryOpinionV1 = z.infer<typeof MinistryOpinionV1>;

/** §7.4 MemorialV1 —— 奏折（八要素硬校验：圣裁/分奏/证据或缺证/风险/后令/质门/来源）。 */
export const MemorialV1 = z
  .object({
    verdict: ZEdictVerdictKind,
    oneSentence: z.string().min(1),
    ministrySignals: z.record(z.string(), ZMinistrySignal),
    departmentSummaries: z.array(
      z.object({ ministry: z.string(), signal: z.string(), ruling: z.string() }),
    ),
    conflicts: z.array(
      z.object({ between: z.tuple([z.string(), z.string()]), summary: z.string() }),
    ),
    evidence: z.array(z.string()),
    missingEvidence: z.array(z.string()),
    risks: z.array(z.string()),
    nextAction: z.string().min(1),
    qualityGate: z.object({
      needsHumanConfirmation: z.boolean(),
      warnings: z.array(z.string()),
    }),
    sourceLabel: ZSourceLabel,
    needsHumanConfirmation: z.boolean(),
  })
  // 八要素硬约束：证据链(evidence 或 missingEvidence 至少一)。
  .refine((m) => m.evidence.length > 0 || m.missingEvidence.length > 0, {
    message: '奏折非法：既无 evidence 也无 missingEvidence',
  })
  // 真实性：DEMO/FALLBACK 不得给"准奏"。
  .refine((m) => !((m.sourceLabel === 'FALLBACK' || m.sourceLabel === 'DEMO') && m.verdict === '准奏'), {
    message: '奏折非法：FALLBACK/DEMO 来源不得准奏',
  });
export type MemorialV1 = z.infer<typeof MemorialV1>;
