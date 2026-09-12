"use client";

import { useState } from "react";
import type { ShiguanArchive, ShiguanOutcomeProjection, ShiguanOutcomeValue } from "../../lib/backendClient.ts";
import { formatBusinessTime } from "../../lib/formatBusinessTime";
import type { ShiguanOutcomeViewState, ShiguanRequestViewState } from "./ShiguanWorkspace";
import styles from "./ShiguanWorkspace.module.css";

const OUTCOME_VALUES: ShiguanOutcomeValue[] = ["ACHIEVED", "PARTIAL", "NOT_ACHIEVED", "OBSERVING"];
const OUTCOME_LABELS: Record<ShiguanOutcomeValue, string> = {
  ACHIEVED: "已达成", PARTIAL: "部分达成", NOT_ACHIEVED: "未达成", OBSERVING: "仍在观察",
};
export interface FrozenOutcomeDraft {
  outcome: ShiguanOutcomeValue;
  occurredAt: string;
  idempotencyKey: string;
  supersedesEventId?: string;
}

export function ShiguanOutcomePanel({archive, outcomes, outcomeState, outcomeListState,
  outcomeNextCursor, pendingOutcomeDraft, onRecord, onLoadMore, onRetryList}: {
  archive: ShiguanArchive;
  outcomes: ShiguanOutcomeProjection[];
  outcomeState: ShiguanOutcomeViewState;
  outcomeListState: ShiguanRequestViewState;
  outcomeNextCursor: string | null;
  pendingOutcomeDraft: FrozenOutcomeDraft | null;
  onRecord(id: string, draft: FrozenOutcomeDraft): void;
  onLoadMore(): void;
  onRetryList(): void;
}) {
  const [outcome, setOutcome] = useState<ShiguanOutcomeValue>("ACHIEVED");
  const [occurredAtLocal, setOccurredAtLocal] = useState("");
  const [correction, setCorrection] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const showState = outcomeState.archiveId === archive.id;
  const isSaving = showState && outcomeState.status === "loading";
  // The controller owns uncertain payloads across archive switches/remounts.
  // A definite rejection removes the draft and permits a new corrected intent.
  const isRetry = !isSaving && pendingOutcomeDraft !== null;
  const locked = isSaving || pendingOutcomeDraft !== null;
  const replaced = new Set(outcomes.map(item => item.supersedesEventId).filter(Boolean));
  const historyComplete = outcomeNextCursor === null && ["ready", "empty"].includes(outcomeListState.status);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (isSaving) return;
    if (pendingOutcomeDraft) {onRecord(archive.id, pendingOutcomeDraft);return;}
    const date = occurredAtLocal ? new Date(occurredAtLocal) : new Date();
    if (!Number.isFinite(date.getTime())) {setLocalError("请输入有效的结果发生时间。");return;}
    if (correction && (replaced.has(correction) || !outcomes.some(item => item.eventId === correction))) {
      setLocalError("更正目标已变化，请刷新结果账并重新选择。");return;
    }
    setLocalError(null);
    onRecord(archive.id, {outcome, occurredAt: date.toISOString(),
      idempotencyKey: `outcome.${crypto.randomUUID()}`,
      ...(correction ? {supersedesEventId: correction} : {})});
  }

  return <section className={styles.reviewCard} aria-label="结果账" data-outcome-panel>
    <div className={styles.reviewCardHeading}>
      <div><span>AUTHENTICATED OUTCOME</span><strong>结果账 · 已加载 {outcomes.length} 条</strong></div>
      <span className={styles.statusBadge}>据实归档 · 不可改写</span>
    </div>
    <p className={styles.archiveMeta} data-outcome-notice>
      结果一经记录即进入不可改写的结果账；如需更正，请选择记录并追加一条更正记录，原记录仍然保留。
      此处仅记录事实，不代表已人工确认，也不构成对外发布或付款授权。
    </p>
    <p className={styles.archiveMeta}>仅支持已采纳且具有完整证据的回奏，是否可记录由后端核验。</p>
    <form className={styles.reviewForm} onSubmit={submit}>
      <label>实际结果<select value={pendingOutcomeDraft?.outcome ?? outcome} disabled={locked}
        onChange={event => setOutcome(event.target.value as ShiguanOutcomeValue)}>
        {OUTCOME_VALUES.map(item => <option key={item} value={item}>{OUTCOME_LABELS[item]}</option>)}
      </select></label>
      <label>结果发生时间<input type="datetime-local" value={occurredAtLocal} disabled={locked}
        onChange={event => setOccurredAtLocal(event.target.value)} /></label>
      <p className={styles.archiveMeta} data-outcome-window-hint>
        发生时间需在本档案采纳时间之后（含该时刻）、且不晚于此刻；留空则记为此刻。
      </p>
      {(correction || pendingOutcomeDraft?.supersedesEventId) && <p className={styles.archiveMeta}>
        正在更正所选记录，原记录将保留。<button type="button" disabled={locked} onClick={() => {setCorrection(null);setLocalError(null);}}>取消更正</button>
      </p>}
      {pendingOutcomeDraft && <p className={styles.archiveMeta}>待确认提交的发生时间：{formatBusinessTime(pendingOutcomeDraft.occurredAt)}。重试沿用同一条。</p>}
      <button disabled={isSaving} type="submit">{isSaving ? "记录中…" : isRetry ? "重试记录（沿用同一条）" : correction ? "提交更正" : "记入结果账"}</button>
      {showState && <p className={outcomeState.status === "error" ? styles.reviewError : styles.reviewMessage}
        role={outcomeState.status === "error" ? "alert" : "status"}>{outcomeState.message}</p>}
      {localError && <p role="alert" className={styles.reviewError}>{localError}</p>}
    </form>
    <p role={outcomeListState.status === "error" ? "alert" : "status"}>{outcomeListState.message}</p>
    {outcomeListState.status === "error" && <button type="button" onClick={onRetryList}>重试读取结果账</button>}
    {outcomes.length > 0 && <ol className={styles.reviewNote} data-outcome-history>
      {outcomes.map(item => <li key={item.eventId} data-outcome-event={item.eventKind}>
        <strong>{OUTCOME_LABELS[item.outcome]}</strong><span>{formatBusinessTime(item.occurredAt)}</span>
        {item.eventKind === "CORRECTED" && <span data-outcome-correction>更正记录（原记录仍在账内保留）</span>}
        {replaced.has(item.eventId) ? <span>已被更正</span> : historyComplete && <button type="button"
          disabled={locked} data-correct-event={item.eventId} onClick={() => {setCorrection(item.eventId);setOutcome(item.outcome);setLocalError(null);}}>更正此记录</button>}
      </li>)}
    </ol>}
    {outcomeNextCursor !== null && <button type="button" data-outcome-more disabled={outcomeListState.status === "loading"} onClick={onLoadMore}>加载更多结果</button>}
    {!historyComplete && outcomes.length > 0 && <p>完整历史加载后可选择更正目标。</p>}
  </section>;
}
