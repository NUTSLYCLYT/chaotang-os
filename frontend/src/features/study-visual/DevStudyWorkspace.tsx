"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import type { DecreeUiState } from "../../app/study/decreeStatus";
import {
  CollapsedEdictScroll,
  EdictStage,
} from "../court-visuals/edict/EdictStage";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import styles from "./DevStudyWorkspace.module.css";
import { StudySideDrawers } from "./StudySideDrawers";
import { StudyArtifactLinks } from "./StudyArtifactLinks";
import { StudyArtifactConfirmation } from "./StudyArtifactConfirmation";
import { getStudyDepartmentCountLabel, projectStudyArtifacts } from "./studyWorkspaceState";
import type { ConsultMessage } from "../../app/study/chancellorConsultStatus";
import type { StudyIntentSnapshot } from "../../app/study/studyIntentConfirmation";
import {
  draftDepartmentDisplayRows,
  projectDraftConfirmation,
  type ChancellorDraftResult,
} from "../../app/study/chancellorDraft";
import { projectQintianDecisionRadar } from "../../app/study/qintianDecisionRadar";
import { createQintianContext } from "../../app/study/qintianWorkspaceState";
import type { StudyRecentRepliesState } from "../../app/study/studyRecentReplies";
import type { ShiguanArchive } from "../../lib/backendClient";
import { formatBusinessTime } from "../../lib/formatBusinessTime";
import {
  canConfirmDailyMemorial,
  dailyMemorialPhaseLabel,
  type DailyMemorialUiState,
} from "../../app/study/dailyMemorialDraft";
import {
  SOURCE_MODE_LABELS,
  projectStudyTaskCockpit,
  projectStudyPrimaryAction,
} from "./studyTaskCockpit";

const ONBOARDED_KEY = "courtos.onboarded";

export interface DevStudyWorkspaceProps {
  decreeText: string;
  uiState: DecreeUiState;
  canEdit: boolean;
  canSubmit: boolean;
  onDecreeTextChange(value: string): void;
  draftResult: ChancellorDraftResult | null;
  draftPending: boolean;
  draftError: string | null;
  onDraft(sourceText: string): void;
  understanding: StudyIntentSnapshot | null;
  onRestate(sourceText: string): void;
  onRetryProgress(): void;
  canRetryProgress: boolean;
  retryProgressLabel: string;
  retryProgressHint: string | null;
  onSubmit(): void;
  recentReplies: StudyRecentRepliesState;
  onOpenRecentReplies(): void;
  onRetryRecentReplies(): void;
  onSelectRecentReply(archiveId: string): void;
  selectedArchivedReply: ShiguanArchive | null;
  onReturnToCurrentReply(): void;
  consultMessages: ConsultMessage[];
  consultPending: boolean;
  consultError: string | null;
  onConsultSend(content: string): Promise<boolean>;
  dailyMemorialState: DailyMemorialUiState;
  onConfirmDailyMemorial(): void;
  onRetryDailyMemorial(): void;
}

function FirstDecreeWelcome({
  onClose,
  onRestate,
}: {
  onClose(): void;
  onRestate(value: string): void;
}) {
  const [target, setTarget] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = [textareaRef.current, actionRef.current].filter(
      (control): control is HTMLTextAreaElement | HTMLButtonElement =>
        control !== null && !control.disabled,
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function startDraft() {
    const normalizedTarget = target.trim();
    if (!normalizedTarget) return;
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      // Storage is optional; first decree remains usable in privacy-restricted browsers.
    }
    onRestate(normalizedTarget);
    onClose();
  }

  return (
    <div
      className={styles.onboardingBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-decree-title"
      onKeyDown={trapFocus}
    >
      <section className={styles.ritual}>
        <header className={styles.ritualHeader}>
          <span>♨</span>
          <strong>丞相</strong>
          <span className={styles.sourceMode}>{SOURCE_MODE_LABELS.LOCAL}</span>
        </header>
        <div className={styles.ritualBody}>
          <p className={styles.eyebrow}>第一旨</p>
          <h2 id="first-decree-title">您想先完成什么？</h2>
          <p className={styles.ritualLead}>先写一个目标，请丞相复述；您确认理解后，才会生成拟旨草案。</p>
          <textarea
            ref={textareaRef}
            className={styles.firstDraft}
            aria-label="第一旨目标"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            rows={5}
            maxLength={2000}
          />
          <div className={styles.ritualActions}>
            <button ref={actionRef} type="button" className={styles.primary} disabled={!target.trim()} onClick={startDraft}>
              请丞相复述
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AcceptanceText({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return <div><dt>{label}</dt><dd>{value === undefined ? "未提供" : value}</dd></div>;
}

function AcceptanceList({
  label,
  values,
  emptyLabel = "未提供",
}: {
  label: string;
  values: string[] | undefined;
  emptyLabel?: string;
}) {
  if (values === undefined) {
    return <div><dt>{label}</dt><dd>未提供</dd></div>;
  }
  if (values.length === 0) {
    return <div><dt>{label}</dt><dd>{emptyLabel}</dd></div>;
  }
  return (
    <div>
      <dt>{label}</dt>
      <dd><ul>{values.map((value) => <li key={value}>{value}</li>)}</ul></dd>
    </div>
  );
}

function resultFollowUpText(
  mode: "revise" | "reuse",
  decreeText: string,
  finalVerdict: string,
): string {
  const instruction = mode === "revise"
    ? "请基于上一回奏提出修改方案，先由丞相复述修改目标，再让我确认后办理。"
    : "请基于上一回奏继续办理一个新任务，先由丞相复述目标，再让我确认后办理。";
  const source = decreeText.trim().slice(0, 760);
  const verdict = finalVerdict.trim().slice(0, 760);
  return [instruction, source ? `原任务：${source}` : "", verdict ? `上一回奏结论：${verdict}` : ""]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2000);
}

function ResultFollowUpActions({
  decreeText,
  finalVerdict,
  onPrepare,
}: {
  decreeText: string;
  finalVerdict: string;
  onPrepare(value: string): void;
}) {
  return (
    <section aria-label="成果下一步" data-testid="result-follow-up-actions">
      <h2>下一步</h2>
      <p>以下操作只会把上下文带回上书房，仍需您编辑、确认拟旨并主动下旨。</p>
      <div>
        <button
          type="button"
          className={styles.recoverySecondary}
          data-testid="result-revise-button"
          onClick={() => onPrepare(resultFollowUpText("revise", decreeText, finalVerdict))}
        >
          提出修改 · 回到上书房
        </button>
        <button
          type="button"
          className={styles.recoverySecondary}
          data-testid="result-reuse-button"
          onClick={() => onPrepare(resultFollowUpText("reuse", decreeText, finalVerdict))}
        >
          复用为新任务 · 回到上书房
        </button>
      </div>
    </section>
  );
}

function VerifiedJobProgress({
  progress,
  freshness = "current",
}: {
  progress: ReturnType<typeof projectStudyTaskCockpit>["progress"];
  freshness?: "current" | "stale";
}) {
  if (!progress) {
    if (freshness !== "stale") return null;
    return (
      <section className={styles.jobProgress} data-testid="decree-job-progress-unavailable">
        <h2>当前状态不可用</h2>
        <p>尚未取得可展示的已验证任务快照。</p>
      </section>
    );
  }
  return (
    <section className={styles.jobProgress} data-testid="decree-job-progress">
      <h2>{freshness === "stale" ? "最后一次已验证任务进度" : "已验证任务进度"}</h2>
      {freshness === "stale" && <p>当前状态不可用，以下为最后一次成功读取的任务快照。</p>}
      <dl>
        <div><dt>jobId</dt><dd>{progress.jobId}</dd></div>
        <div><dt>state</dt><dd>{progress.state}</dd></div>
        <div><dt>stage</dt><dd>{progress.stage}</dd></div>
        <div><dt>attemptCount</dt><dd>{progress.attemptCount}</dd></div>
        <div><dt>providerRequestCount</dt><dd>{progress.providerRequestCount}</dd></div>
        <div><dt>createdAt</dt><dd><time dateTime={progress.createdAt}>{formatBusinessTime(progress.createdAt)}</time></dd></div>
        <div><dt>updatedAt</dt><dd><time dateTime={progress.updatedAt}>{formatBusinessTime(progress.updatedAt)}</time></dd></div>
      </dl>
    </section>
  );
}

export function DevStudyWorkspace(props: DevStudyWorkspaceProps) {
  const [expanded, setExpanded] = useState(false);
  const [displayMode, setDisplayMode] = useState<"smart" | "custom">("smart");
  const understandingCardRef = useRef<HTMLElement>(null);
  const polished = false;
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showFirstVisit, setShowFirstVisit] = useState<boolean | null>(null);
  const archivedReply = props.selectedArchivedReply;
  const archivedReplyId = archivedReply?.id;
  const archivedReplyRef = useRef<HTMLElement>(null);
  const hasDailyMemorialDraft = (
    props.dailyMemorialState.phase === "ready" ||
    props.dailyMemorialState.phase === "confirming" ||
    props.dailyMemorialState.phase === "confirmed"
  ) && props.dailyMemorialState.draft !== null;
  const showScroll = expanded || archivedReply !== null || props.uiState.phase !== "idle" || props.draftPending || props.draftError !== null || props.draftResult !== null;
  const hasReplyContent = archivedReply !== null || props.uiState.phase === "success" || props.uiState.phase === "idle" || props.draftPending || props.draftError !== null || props.draftResult !== null;
  const artifactView = projectStudyArtifacts(props.uiState);
  const draftConfirmation = props.draftResult
    ? projectDraftConfirmation(props.draftResult)
    : null;
  const action = projectStudyPrimaryAction({
    uiPhase: props.uiState.phase, draftStatus: props.draftResult?.status ?? null,
    draftPending: props.draftPending, consultPending: props.consultPending,
    understandingReady: props.understanding !== null, goal: props.decreeText,
    dailyMemorialReady: canConfirmDailyMemorial(props.dailyMemorialState),
  });
  const welcomeVisible = showFirstVisit === true && action.stage === "EMPTY";
  const actionSurfaceReady = showFirstVisit !== null && !welcomeVisible;
  useEffect(() => {
    if (!props.understanding) return;
    const timer = window.setTimeout(() => understandingCardRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [props.understanding]);
  const qintianRadar = projectQintianDecisionRadar({
    decreeText: props.decreeText,
    draftResult: props.draftResult,
    draftPending: props.draftPending,
    draftError: props.draftError,
    uiState: props.uiState,
  });
  const cockpit = projectStudyTaskCockpit({
    decreeText: props.decreeText,
    draftResult: props.draftResult,
    uiState: props.uiState,
  });
  const qintianContext = createQintianContext({
    decreeText: props.decreeText,
    draft: props.draftResult
      ? {
          fingerprint: props.draftResult.fingerprint,
          content: props.draftResult.expert_example,
        }
      : null,
    currentReply: props.uiState.phase === "success"
      ? {
          id: `${props.uiState.routeType}-${props.uiState.processingPath.join("-")}`,
          content: [
            props.uiState.rationale,
            props.uiState.finalVerdict,
            ...props.uiState.recommendations,
          ].join("\n"),
        }
      : null,
    archivedReply: archivedReply
      ? {
          id: archivedReply.id,
          content: [
            archivedReply.sourceText,
            archivedReply.replyProcess,
            archivedReply.replyConclusion,
          ].join("\n"),
        }
      : null,
  });

  useEffect(() => {
    if (!hasDailyMemorialDraft) return;
    const timer = window.setTimeout(() => {
      setExpanded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hasDailyMemorialDraft]);

  useEffect(() => {
    if (!archivedReplyId) return;
    const timer = window.setTimeout(() => {
      setExpanded(true);
      archivedReplyRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [archivedReplyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const forceForQa = new URLSearchParams(window.location.search).get("first-decree") === "1";
        setShowFirstVisit(forceForQa || window.localStorage.getItem(ONBOARDED_KEY) !== "1");
      } catch {
        setShowFirstVisit(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    setAttachments(Array.from(event.target.files ?? []).map((file) => file.name).slice(0, 3));
    event.currentTarget.value = "";
  }

  const composer = (
    <section className={styles.composer} aria-label="御前拟旨">
      <p className={styles.sourceMode} data-source-mode="LOCAL">
        {SOURCE_MODE_LABELS.LOCAL}
      </p>
      {(polished || attachments.length > 0) && (
        <p className={styles.localNotice}>
          {polished ? "润色预览已开启 · 未调用模型" : ""}
          {polished && attachments.length ? "　·　" : ""}
          {attachments.length ? `本地待附 ${attachments.length} 份 · 提交接口暂不上传附件` : ""}
        </p>
      )}
      <div className={styles.composerRow}>
        <label className={styles.attach} data-testid="decree-evidence-upload" title="选择本地补证附件（当前不会上传）">上传附件<input type="file" multiple onChange={handleFiles} disabled={!props.canEdit} /></label>
        <textarea id="decree-text" aria-label="希望达成的目标" data-testid="decree-textarea" value={props.decreeText} onChange={(event) => props.onDecreeTextChange(event.target.value)} rows={1} maxLength={2000} disabled={!props.canEdit} placeholder="先说明目标，确认丞相复述后再生成拟旨……" />
        {actionSurfaceReady && (action.stage === "EMPTY" || action.stage === "UNDERSTANDING_READY") && (
          <button type="button" className={styles.draftAction} data-testid="draft-edict-button" disabled={!props.canEdit || !props.decreeText.trim()} onClick={() => {
            if (action.stage === "EMPTY") props.onRestate(props.decreeText);
            else props.onDraft(props.decreeText);
          }}>{action.label}</button>
        )}
        {actionSurfaceReady && action.stage === "DRAFT_BLOCKED" && (
          <button
            type="button"
            className={styles.draftAction}
            data-testid="draft-blocked-recovery"
            disabled={!props.canRetryProgress}
            onClick={props.onRetryProgress}
          >
            {action.label}
          </button>
        )}
      </div>
      {actionSurfaceReady && action.stage === "DRAFT_BLOCKED" && !props.canRetryProgress && props.retryProgressHint && (
        <p className={styles.recoveryHint}>{props.retryProgressHint}</p>
      )}
      {props.consultError && <p role="alert" className={styles.localNotice}>{props.consultError}</p>}
      {props.draftError && <p className={styles.localNotice}>{props.draftError}</p>}
    </section>
  );
  const drawers = (
    <StudySideDrawers
      qintianRadar={qintianRadar}
      qintianContext={qintianContext}
      onPrefillDecree={props.onDecreeTextChange}
      recentReplies={props.recentReplies}
      onOpenRecentReplies={props.onOpenRecentReplies}
      onRetryRecentReplies={props.onRetryRecentReplies}
      onSelectRecentReply={props.onSelectRecentReply}
      messages={props.consultMessages}
      pending={props.consultPending}
      error={props.consultError}
      onSend={props.onConsultSend}
    />
  );

  return (
    <ImmersiveCourtShell
      currentLabel="上书房"
      currentPath="/study"
      backgroundImage="/shangshufang/bg-shangshufang-scene.webp"
      quickDockCenter={composer}
      overlay={drawers}
      scene="study"
    >
      <div className={styles.stage}>
        <div className={styles.displayMode} role="group" aria-label="展示深度">
          <button type="button" aria-pressed={displayMode === "smart"} onClick={() => setDisplayMode("smart")}>智能版</button>
          <button type="button" aria-pressed={displayMode === "custom"} onClick={() => setDisplayMode("custom")}>定制版</button>
          <span>同一任务，仅改变信息展开程度</span>
        </div>
        <button
          className={styles.scrollToggle}
          type="button"
          onClick={() => {
            if (archivedReply) {
              props.onReturnToCurrentReply();
              return;
            }
            setExpanded((value) => !value);
          }}
        >
          <span aria-hidden="true">{showScroll ? "↙" : "↗"}</span>
          {showScroll ? "收卷看殿" : "展卷"}
        </button>

        <section
          className={`${styles.edictSlot} ${
            showScroll
              ? hasReplyContent
                ? styles.expandedSlot
                : styles.emptyExpanded
              : styles.collapsedSlot
          }`}
        >
          {action.stage === "CONSULTING" ? (
            <section className={styles.emptyStage} aria-live="polite" data-testid="chancellor-restatement-pending">
              <h2>丞相正在复述目标</h2><p>本次仅咨询，不创建办理任务。</p>
            </section>
          ) : action.stage === "UNDERSTANDING_READY" && props.understanding ? (
            <section ref={understandingCardRef} tabIndex={-1} className={styles.understandingCard} data-testid="study-understanding-card" aria-labelledby="understanding-title">
              <h2 id="understanding-title">请确认丞相的理解</h2>
              <p>以下为咨询接口的原文，尚未执行；请核对缺失资料、证据与限制。</p>
              <h3>您的原始目标</h3><p>{props.understanding.normalizedOriginalGoal}</p>
              <h3>丞相复述</h3><p data-testid="exact-chancellor-restatement">{props.understanding.exactLatestChancellorRestatement}</p>
              <p>理解不准确时，请修改下方目标或在咨询中补充；旧确认会失效。</p>
            </section>
          ) : !showScroll && (props.uiState.phase !== "idle" || hasDailyMemorialDraft) ? (
            <CollapsedEdictScroll
              title="每日奏折"
              status={dailyMemorialPhaseLabel(props.dailyMemorialState.phase)}
              source="39司 · 6部 · 丞相"
              countLabel={getStudyDepartmentCountLabel(props.uiState)}
              onOpen={() => setExpanded(true)}
            />
          ) : props.draftPending ? (
            <section className={styles.emptyStage} data-testid="chancellor-draft-pending" aria-live="polite">
              <p>丞相正在揣摩上意并整理拟旨草案……</p>
            </section>
          ) : props.draftError ? (
            <section className={styles.emptyStage} data-testid="chancellor-draft-error" aria-live="polite">
              <p className={styles.emptyError}><strong>拟旨未能完成</strong>{props.draftError}</p>
            </section>
          ) : props.uiState.phase === "error" ? (
            <section className={styles.emptyStage} data-testid="decree-submission-error" aria-live="polite">
              <p className={styles.sourceMode} data-source-mode={cockpit.sourceMode}>
                {SOURCE_MODE_LABELS[cockpit.sourceMode]}
              </p>
              <p className={styles.emptyError}><strong>办理未能完成</strong>尚未完成，不代表已归档。</p>
              <details data-testid="decree-failure-details">
                <summary className={styles.retryProgress}>查看原因与下一步</summary>
                <p>{props.uiState.message}</p>
              <VerifiedJobProgress
                progress={cockpit.progress}
                freshness={props.uiState.progressFreshness ?? "current"}
              />
              <button
                type="button"
                className={styles.recoverySecondary}
                data-testid="retry-decree-progress"
                disabled={!actionSurfaceReady || !props.canRetryProgress}
                onClick={props.onRetryProgress}
              >
                {props.retryProgressLabel}
              </button>
              {props.retryProgressHint && <p className={styles.recoveryHint}>{props.retryProgressHint}</p>}
              </details>
            </section>
          ) : ["enqueueing", "queued", "running"].includes(props.uiState.phase) ? (
            <section
              className={styles.emptyStage}
              data-testid="decree-status"
              data-phase={props.uiState.phase}
              aria-live="polite"
            >
              <p className={styles.sourceMode} data-source-mode={cockpit.sourceMode}>
                {SOURCE_MODE_LABELS[cockpit.sourceMode]}
              </p>
              {props.uiState.phase === "enqueueing" && <p>圣旨正在入队……</p>}
              {props.uiState.phase === "queued" && <p>圣旨已入队，正在等候办理……</p>}
              {props.uiState.phase === "running" && <p>丞相与百官正在办理圣旨……</p>}
              <VerifiedJobProgress progress={cockpit.progress} />
            </section>
          ) : props.draftResult ? (
            <EdictStage
              document={{
                id: `draft-${props.draftResult.fingerprint}`,
                kicker: `丞相拟旨 · 第 ${props.draftResult.version} 版`,
                title: "拟旨草案",
                issuer: `当前状态 · ${props.draftResult.status}`,
              }}
              theme="imperial"
              bodyLabel="丞相拟旨草案"
            >
              <section className={styles.response} data-testid="chancellor-draft-result">
                <div className={styles.returnContent}>
                  <p className={styles.sourceMode} data-source-mode={cockpit.sourceMode}>
                    {SOURCE_MODE_LABELS[cockpit.sourceMode]}
                  </p>
                  {props.draftResult.draft && (
                    <section data-testid="chancellor-readable-draft" hidden={displayMode !== "custom"}>
                      <h2>参与部门</h2>
                      <ul data-testid="chancellor-draft-departments">
                        {draftDepartmentDisplayRows(props.draftResult.draft.departments).map((item) => (
                          <li key={`${item.department}-${item.role}`}>
                            <p><strong>参与部门：</strong>{item.department}</p>
                            <p><strong>必选承办司：</strong>{item.bureaus}</p>
                            <p><strong>角色：</strong>{item.role}</p>
                            <p><strong>参与原因：</strong>{item.reason}</p>
                            <p>负责事项：{item.responsibility}</p>
                            <p><strong>预计产出：</strong>{item.expectedOutput}</p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {cockpit.acceptance && (
                    <section className={styles.acceptanceContract} data-testid="chancellor-acceptance-contract">
                      <h2>任务验收契约</h2>
                      <dl className={styles.acceptanceGrid}>
                        <AcceptanceText label="任务目标" value={cockpit.acceptance.objective} />
                        <AcceptanceList label="执行范围" values={cockpit.acceptance.scope} />
                        <AcceptanceList label="不包含" values={cockpit.acceptance.exclusions} emptyLabel="无排除项" />
                        <AcceptanceList label="输入材料" values={cockpit.acceptance.inputMaterials} />
                        <AcceptanceList label="材料缺口" values={cockpit.acceptance.materialGaps} emptyLabel="无已知材料缺口" />
                        <AcceptanceList label="重点问题" values={cockpit.acceptance.keyQuestions} />
                        <AcceptanceList label="执行步骤" values={cockpit.acceptance.executionSteps} />
                        <AcceptanceList label="最终交付物" values={cockpit.acceptance.deliverables} />
                        <AcceptanceList label="完成标准" values={cockpit.acceptance.completionCriteria} />
                        <AcceptanceList label="权限与限制" values={cockpit.acceptance.permissionsAndLimits} />
                      </dl>
                    </section>
                  )}
                  <h2>即将下旨的草案</h2>
                  <p data-testid="chancellor-issue-draft">{draftConfirmation?.visibleCanonicalText}</p>
                  <p><strong>当前状态：</strong>{props.draftResult.status}</p>
                  <p>
                    <strong>下旨：</strong>
                    {props.canSubmit
                      ? "草案完整，可以直接下旨"
                      : props.draftResult.revision_prompt}
                  </p>
                  {actionSurfaceReady && action.stage === "DRAFT_READY" && draftConfirmation?.showIssueAction && (
                    <button
                      type="button"
                      className={styles.submit}
                      data-testid="submit-decree-button"
                      disabled={!props.canSubmit}
                      onClick={props.onSubmit}
                    >
                      确认下旨 · 开始办理
                    </button>
                  )}
                </div>
              </section>
            </EdictStage>
          ) : archivedReply ? (
            <EdictStage
              document={{
                id: `study-archive-${archivedReply.id}`,
                kicker: "史馆留痕 · 上书房阅奏",
                title: "回奏",
                issuer: `${archivedReply.respondent} · ${formatBusinessTime(archivedReply.replyTime)}`,
              }}
              theme="imperial"
              bodyLabel="史馆归档回奏"
            >
              <section
                ref={archivedReplyRef}
                className={styles.archivedReply}
                tabIndex={-1}
                data-testid="archived-reply-scroll"
              >
                <p><strong>原旨正文</strong>{archivedReply.sourceText}</p>
                <p><strong>办理过程</strong>{archivedReply.replyProcess}</p>
                <p><strong>参与部门</strong>{archivedReply.participatingDepartments!.join("、")}</p>
                <p><strong>回奏结论</strong>{archivedReply.replyConclusion}</p>
                <p><strong>回奏时间</strong><time dateTime={archivedReply.replyTime ?? undefined}>{formatBusinessTime(archivedReply.replyTime)}</time></p>
                <p><strong>责任主体</strong>{archivedReply.respondent}</p>
              </section>
            </EdictStage>
          ) : props.uiState.phase === "success" ? (
            <EdictStage
              document={{
                id: `study-${props.uiState.routeType}`,
                kicker: "奉天承运 · 上书房",
                title: "圣旨",
                issuer: "旨意下达 · 丞相回奏 · 史馆留痕",
              }}
              theme="imperial"
              bodyLabel="丞相与百官回奏"
            >
              <section
                className={styles.response}
                data-testid="decree-status"
                data-phase={props.uiState.phase}
                data-decree-ok="true"
                aria-live="polite"
              >
                <div className={styles.returnContent}>
                  <p className={styles.sourceMode} data-source-mode={cockpit.sourceMode}>
                    {SOURCE_MODE_LABELS[cockpit.sourceMode]}
                  </p>
                  <VerifiedJobProgress progress={cockpit.progress} />
                  <p data-testid="decree-rationale"><strong>{props.uiState.chancellor}判断</strong>{props.uiState.rationale}</p>
                  <p className={styles.path} data-testid="decree-processing-path"><strong>流转路径</strong>{props.uiState.processingPath.join(" → ")}</p>
                  <h2>分层部门意见</h2>
                  <ul data-testid="decree-ministry-opinions">
                    {props.uiState.ministryOpinions.map((opinion) => (
                      <li key={opinion.department}>
                        <h3>{opinion.department}</h3>
                        <ol data-testid={`decree-bureau-opinions-${opinion.department}`}>
                          {opinion.bureauOpinions.map((bureauOpinion) => (
                            <li key={bureauOpinion.bureau}><strong>{bureauOpinion.bureau}</strong>：{bureauOpinion.opinion}</li>
                          ))}
                        </ol>
                        <p><strong>部议：</strong>{opinion.opinion}</p>
                      </li>
                    ))}
                  </ul>
                  {props.uiState.routeType === "multi" && (
                    <p data-testid="decree-council-verdict"><strong>军机处会审：</strong>{props.uiState.councilVerdict}</p>
                  )}
                  <p data-testid="decree-final-verdict"><strong>丞相总结：</strong>{props.uiState.finalVerdict}</p>
                  <h2>丞相三项建议</h2>
                  <ol data-testid="decree-recommendations">
                    {props.uiState.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
                  </ol>
                  <StudyArtifactLinks artifacts={artifactView} className={styles.artifact} />
                  {artifactView.map((artifact) => (
                    <StudyArtifactConfirmation key={artifact.artifactId} artifactId={artifact.artifactId} />
                  ))}
                  <ResultFollowUpActions
                    decreeText={props.decreeText}
                    finalVerdict={props.uiState.finalVerdict}
                    onPrepare={props.onDecreeTextChange}
                  />
                </div>
              </section>
            </EdictStage>
          ) : (props.uiState.phase as string) === "idle" ? (
            <EdictStage
              document={{
                id: "daily-memorial",
                kicker: "39司 → 6部 → 丞相",
                title: "每日奏折",
                issuer: dailyMemorialPhaseLabel(props.dailyMemorialState.phase),
              }}
              theme="imperial"
              bodyLabel="每日奏折摘要"
            >
              <section className={styles.dailyMemorialBody} data-phase={props.dailyMemorialState.phase}>
                <h2 id="daily-memorial-title">每日奏折</h2>
                <p className={styles.dailyMemorialStatus} aria-live="polite">{props.dailyMemorialState.message}</p>
                {(props.dailyMemorialState.phase === "ready" || props.dailyMemorialState.phase === "confirming" || props.dailyMemorialState.phase === "confirmed") && props.dailyMemorialState.draft && (
                  <>
                    <dl className={styles.dailyMemorialMeta}>
                      <div><dt>报告日期</dt><dd>{props.dailyMemorialState.draft.reportDate}</dd></div>
                      <div><dt>事实截止</dt><dd>{formatBusinessTime(props.dailyMemorialState.draft.sourceWindowEnd)}</dd></div>
                    </dl>
                    <p className={styles.dailyMemorialProgress}><span>39/39 司</span><i aria-hidden="true">→</i><span>6/6 部</span><i aria-hidden="true">→</i><span>丞相汇总</span></p>
                    <div className={styles.dailyMemorialContent}>{props.dailyMemorialState.draft.content}</div>
                    <p className={styles.dailyMemorialFacts}>事实引用 {props.dailyMemorialState.draft.factRefs.length} 条</p>
                    {actionSurfaceReady && action.stage === "DAILY_MEMORIAL_REVIEW_ONLY" && <button type="button" className={styles.dailyMemorialConfirm} onClick={props.onConfirmDailyMemorial} disabled={!canConfirmDailyMemorial(props.dailyMemorialState)}>确认上奏并归档为奏折</button>}
                  </>
                )}
                {props.dailyMemorialState.phase === "no_facts" && <p className={styles.dailyMemorialNotice}>报告期内没有可用的受控事实，因此没有生成待审草稿。</p>}
                {(props.dailyMemorialState.phase === "failed" || props.dailyMemorialState.phase === "error") &&
                  action.stage === "EMPTY" && !props.decreeText.trim() && actionSurfaceReady &&
                  <button type="button" className={styles.dailyMemorialRetry} onClick={props.onRetryDailyMemorial}>重新读取状态</button>}
              </section>
            </EdictStage>
          ) : (
            <section
              className={styles.emptyStage}
              data-testid="decree-status"
              data-phase={props.uiState.phase}
              aria-live="polite"
            >
              {props.uiState.phase === "idle" && <p>暂无奏折，陛下可下达新旨。</p>}
              {props.uiState.phase === "enqueueing" && <p>圣旨正在入队……</p>}
              {props.uiState.phase === "queued" && <p>圣旨已入队，正在等候办理……</p>}
              {props.uiState.phase === "running" && <p>丞相与百官正在办理圣旨……</p>}
              <VerifiedJobProgress progress={cockpit.progress} />
            </section>
          )}
        </section>

      </div>
      {welcomeVisible && (
        <FirstDecreeWelcome
          onClose={() => setShowFirstVisit(false)}
          onRestate={props.onRestate}
        />
      )}
    </ImmersiveCourtShell>
  );
}
