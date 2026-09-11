import { parseS4RuleAnalysis, type S4RuleAnalysis } from "./client.ts";
import { isSceneId } from "./sceneBoardController.ts";
import type { SceneMission, SceneRun } from "./types.ts";

export function riskText(value: string) {
  return ({low:"低",medium:"中",high:"高"} as Record<string,string>)[value] ?? "未知";
}
export function stageText(value: string) {
  return ({todo:"待办",in_progress:"推进中",awaiting_input:"待补资料",blocked:"阻断",done:"已标记完成"} as Record<string,string>)[value] ?? "未知";
}
export function runStatusText(value: string) {
  return ({created:"已创建",running:"生成中",completed:"生成完成",blocked:"生成阻断",failed:"生成失败"} as Record<string,string>)[value] ?? "未知";
}

/** Presentation only: no details-derived authority, URLs, progress or artifacts. */
export function buildV4Presentation(mission: SceneMission | null, run: SceneRun | null) {
  if (!mission || !run || !isSceneId(mission.missionId) || !isSceneId(mission.runId)
    || mission.missionId !== run.missionId || mission.runId !== run.runId || mission.packSlug !== run.packSlug) return null;
  const ruleAnalysis = parseS4RuleAnalysis(run);
  return {
    ...(ruleAnalysis.state === "not-s4" ? {} : {ruleAnalysis}),
    identityKey: mission.missionId + ":" + mission.runId,
    missionId: mission.missionId,
    runId: mission.runId,
    packSlug: mission.packSlug,
    title: mission.title,
    packName: mission.packName,
    stageLabel: stageText(mission.stage),
    statusLabel: runStatusText(run.status),
    risk: run.riskGrade,
    riskLabel: riskText(run.riskGrade),
    realityLabel: run.demo ? "示例结果 · 不用于正式业务决策" : "非示例结果 · 不表示事实已独立核验",
    verdict: run.verdictText,
    summary: run.summaryForUser,
    missingItems: [...run.missingItems],
    nextActions: run.nextActions.map(a => ({title:a.title,ownerDept:a.ownerDept,priority:a.priority,dueHint:a.dueHint})),
    evidenceRefs: run.evidenceRefs.map(e => ({claim:e.claim,sourceLabel:e.sourceLabel,sourceType:e.sourceType,capturedAt:e.capturedAt,reliability:e.reliability})),
  };
}
type InferredV4Presentation = NonNullable<ReturnType<typeof buildV4Presentation>>;
export type V4Presentation = InferredV4Presentation & {ruleAnalysis?: Exclude<S4RuleAnalysis, {state: "not-s4"}>};
