/**
 * 朝堂 OS · 上书房圣旨（Study Edict）· Zod 单一真相源（SoT）
 *
 * 这是 Study Edict 形状的**唯一**真相源：E2E fixture（e2e/true-loop-contract.spec.ts）
 * 与真实后端契约测试都对照这份 schema 校验，确保两侧验证的是同一形状，杜绝漂移。
 *
 * 与 `src/lib/api/chaotang.ts` 中的 TS interface（StudyEdict 及其子类型）一一对应。
 * 当后端响应新增字段时，先改这里，再同步 chaotang.ts 的 interface。
 *
 * 地面真相（mirror exactly）：
 *   - dev/reference/artifacts/alignment-2026-06-08/real_live_edict.json（source_mode=LIVE_SWARM，含 run_adapter）
 *   - dev/reference/artifacts/alignment-2026-06-08/real_dry_edict.json（source_mode=MIXED，无 run_adapter）
 *
 * 使用方式：
 *   import { ZStudyEdict, ZStudyEnvelope } from '@/lib/contracts/study-edict';
 *   const result = ZStudyEnvelope.safeParse(rawJson);
 *   if (!result.success) console.error(result.error);
 *
 * 设计取舍：
 *   - source_mode 故意用 z.enum 严格校验——未知 mode 必须 parse 失败，让契约漂移当场被抓。
 *   - 其余对象用 .passthrough()——后端新增的附加字段不破坏校验（前向兼容）。
 */

import { z } from 'zod';

/* ==========================================================================
   source_mode —— 严格枚举（含真实后端 LIVE_SWARM；未知值必须 parse 失败）
   ========================================================================== */

export const STUDY_SOURCE_MODES = [
  'LIVE',
  'MIXED',
  'FALLBACK',
  'DEMO',
  'LIVE_SWARM',
] as const;

/* ==========================================================================
   子结构 —— 镜像 chaotang.ts 的 StudyEdict* interface
   ========================================================================== */

export const ZStudyEdictDepartment = z
  .object({
    dept: z.string(),
    name: z.string(),
    opinion: z.string(),
    confidence: z.number(),
    status: z.string(),
    run_id: z.string(),
  })
  .passthrough();

export const ZStudyEdictEvidence = z
  .object({
    label: z.string(),
    value: z.union([z.string(), z.number()]),
    source: z.string(),
  })
  .passthrough();

export const ZStudyEdictNextAction = z
  .object({
    type: z.string(),
    label: z.string(),
    target: z.string(),
    owner: z.string(),
  })
  .passthrough();

/* ==========================================================================
   run_adapter —— live-only（dry_run 响应不含），整块可选
   形状取自 real_live_edict.json
   ========================================================================== */

export const ZStudyReplayArtifact = z
  .object({
    kind: z.string(),
    session_id: z.string(),
    path: z.string(),
    api_path: z.string(),
    owner: z.string(),
  })
  .passthrough();

export const ZStudyRunAdapter = z
  .object({
    name: z.string(),
    session_id: z.string(),
    entry_swarm: z.string(),
    status: z.string(),
    run_count: z.number(),
    completed_count: z.number(),
    replay_artifact: ZStudyReplayArtifact,
  })
  .passthrough();

/* ==========================================================================
   quality_gate —— config 仅在 live 响应出现（entry_swarm + bindings），整块可选
   ========================================================================== */

export const ZStudyQualityGate = z
  .object({
    status: z.string(),
    score: z.number(),
    reasons: z.array(z.string()),
    human_signoff_required: z.boolean(),
    config: z.unknown().optional(),
  })
  .passthrough();

/* ==========================================================================
   LaunchLoopCase —— 上书房 -> 蜂群 -> 史馆的统一闭环案卷
   ========================================================================== */

export const ZLaunchLoopCaseQualityGate = z
  .object({
    status: z.string(),
    score: z.number(),
    reasons: z.array(z.string()),
    humanSignoffRequired: z.boolean(),
  })
  .passthrough();

export const ZLaunchLoopCaseNextAction = z
  .object({
    type: z.string(),
    label: z.string(),
    target: z.string(),
    owner: z.string(),
  })
  .passthrough();

export const ZLaunchLoopCaseArchive = z
  .object({
    owner: z.string(),
    store: z.string(),
    replayApiPath: z.string(),
    retrospectiveApiPath: z.string(),
    artifactPath: z.string().nullable(),
  })
  .passthrough();

export const ZLaunchLoopCaseLearning = z
  .object({
    owner: z.string(),
    target: z.string(),
    status: z.string(),
  })
  .passthrough();

export const ZLaunchLoopCase = z
  .object({
    case_id: z.string(),
    schemaVersion: z.literal('launch_loop_case.v1'),
    source: z.string(),
    sourceId: z.string(),
    title: z.string(),
    command: z.string(),
    owner: z.string(),
    targetDept: z.string(),
    evidenceIds: z.array(z.string()),
    evidence: z.array(ZStudyEdictEvidence),
    taskId: z.string().nullable(),
    runId: z.string(),
    decisionId: z.string().nullable(),
    status: z.string(),
    sourceMode: z.enum(STUDY_SOURCE_MODES),
    qualityGate: ZLaunchLoopCaseQualityGate,
    nextAction: ZLaunchLoopCaseNextAction,
    archive: ZLaunchLoopCaseArchive,
    learning: ZLaunchLoopCaseLearning,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const ZLaunchLoopGate = z
  .object({
    passed: z.boolean(),
    reasons: z.array(z.string()),
    case_id: z.string(),
  })
  .passthrough();

export const ZLaunchLoopArchiveWrite = z
  .object({
    archivePath: z.string(),
    case_id: z.string(),
  })
  .passthrough();

/* ==========================================================================
   StudyEdict —— 顶层圣旨
   ========================================================================== */

export const ZStudyEdict = z
  .object({
    run_id: z.string(),
    // 故意严格：未知 source_mode 必须 parse 失败，让契约漂移当场被抓。
    source_mode: z.enum(STUDY_SOURCE_MODES),
    title: z.string(),
    verdict: z.string(),
    summary: z.string(),
    departments: z.array(ZStudyEdictDepartment),
    evidence: z.array(ZStudyEdictEvidence),
    risks: z.array(z.string()),
    next_actions: z.array(ZStudyEdictNextAction),
    quality_gate: ZStudyQualityGate,
    created_at: z.string(),
    run_adapter: ZStudyRunAdapter.optional(),
  })
  .passthrough();

/* ==========================================================================
   API 封套 —— { success, data: { edict }, error? }（/api/court/chaotang/study/run）
   ========================================================================== */

export const ZStudyEnvelope = z
  .object({
    success: z.boolean(),
    data: z
      .object({
        edict: ZStudyEdict,
        launchLoopCase: ZLaunchLoopCase.optional(),
        launchLoopGate: ZLaunchLoopGate.optional(),
        launchLoopArchive: ZLaunchLoopArchiveWrite.optional(),
      })
      .passthrough(),
    error: z.string().nullable().optional(),
  })
  .passthrough();

/* ==========================================================================
   推断类型 —— 下游可直接消费
   ========================================================================== */

export type TStudyEdict = z.infer<typeof ZStudyEdict>;
export type TStudyEnvelope = z.infer<typeof ZStudyEnvelope>;
export type TStudySourceMode = (typeof STUDY_SOURCE_MODES)[number];
export type TLaunchLoopCase = z.infer<typeof ZLaunchLoopCase>;
