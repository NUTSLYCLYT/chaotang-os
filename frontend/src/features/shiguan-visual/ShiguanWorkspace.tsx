"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  ArchiveDecisionValue,
  ReviewStatusValue,
  ShiguanArchive,
  ShiguanOutcomeProjection,
  ShiguanRecallMatch,
  ShiguanStatistics,
} from "../../lib/backendClient.ts";
import { formatBusinessTime } from "../../lib/formatBusinessTime";
import type { CourtDataState } from "../court-visuals/types";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import {
  CollapsedEdictScroll,
  EdictStage,
} from "../court-visuals/edict/EdictStage";
import {
  ARCHIVE_TYPE_LABELS,
  formatArchiveType,
  formatRealityLabel,
  formatReviewStatus,
  formatSuccessRate,
} from "../../app/shiguan/archiveStatus.ts";
import { ShiguanArchiveDetail, ShiguanReviewControl } from "./ShiguanArchiveDetail";
import { ShiguanOutcomePanel, type FrozenOutcomeDraft } from "./ShiguanOutcomePanel";
import styles from "./ShiguanWorkspace.module.css";

export interface ShiguanRequestViewState {
  status: CourtDataState;
  message: string;
  stale: boolean;
  errorKind: string | null;
  deepLinkRetryAvailable?: boolean;
}

export interface ShiguanReviewViewState extends ShiguanRequestViewState {
  archiveId: string | null;
}

export interface ShiguanDecisionViewState extends ShiguanRequestViewState {
  archiveId: string | null;
}

export interface ShiguanOutcomeViewState extends ShiguanRequestViewState {
  archiveId: string | null;
}

export interface ShiguanWorkspaceProps {
  archives: ShiguanArchive[];
  selectedArchive: ShiguanArchive | null;
  statistics: ShiguanStatistics | null;
  matches: ShiguanRecallMatch[];
  archiveState: ShiguanRequestViewState;
  statisticsState: ShiguanRequestViewState;
  recallState: ShiguanRequestViewState;
  reviewState: ShiguanReviewViewState;
  decisionState: ShiguanDecisionViewState;
  outcomes: ShiguanOutcomeProjection[];
  outcomeState: ShiguanOutcomeViewState;
  outcomeListState: ShiguanRequestViewState;
  outcomeNextCursor: string | null;
  pendingOutcomeDraft: FrozenOutcomeDraft | null;
  onLoadMoreOutcomes(): void;
  onRetryOutcomes(): void;
  onRecordOutcome(id: string, draft: FrozenOutcomeDraft): void;
  onSelectArchive(id: string): void;
  onFilter(input: { type: string; matterType: string; department: string }): void;
  onRecall(input: { matterType: string; department: string }): void;
  onReview(id: string, input: { status: ReviewStatusValue; note: string }): void;
  onDecision(id: string, decision: ArchiveDecisionValue): void;
  onRetryArchives(): void;
  onRetryStatistics(): void;
  onRetryRecall(): void;
}

export function ShiguanWorkspace(props: ShiguanWorkspaceProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const archiveDocument = {
    id: props.selectedArchive?.id ?? "shiguan-empty",
    kicker: props.selectedArchive ? "ARCHIVE CASE" : "ARCHIVE SCROLL",
    title: props.selectedArchive?.title ?? "史馆案卷总览",
    issuer: props.selectedArchive ? "太史令 · 史馆中卷" : "太史令 · 系统空卷",
  };

  return (
    <ImmersiveCourtShell
      currentLabel="太史馆"
      currentPath="/shiguan"
      backgroundImage="/assets/shiguan/shiguan.webp"
      scene="shiguan"
    >
      <header className={styles.identity}>
        <div>
          <p>Shiguan Memory Router</p>
          <h1>太史馆</h1>
          <span>归档、复盘、旧案召回与可信留痕。中间卷轴展示当前案卷，左右面板负责索引和反哺。</span>
        </div>
        <button type="button" onClick={() => setDrawerOpen(true)}>
          打开史馆说明
        </button>
      </header>

      <div className={styles.columns}>
        <aside className={styles.indexColumn} data-shiguan-index>
          <ArchiveIndexPanel
            archives={props.archives}
            statistics={props.statistics}
            archiveState={props.archiveState}
            statisticsState={props.statisticsState}
            selectedId={props.selectedArchive?.id ?? null}
            onSelect={props.onSelectArchive}
            onFilter={props.onFilter}
            onRetryArchives={props.onRetryArchives}
            onRetryStatistics={props.onRetryStatistics}
          />
        </aside>
        <section className={styles.detailColumn} data-shiguan-detail>
          <EdictStage
            className={styles.edictStage}
            document={archiveDocument}
            theme="imperial"
            bodyLabel="史馆案卷正文"
          >
            <ShiguanArchiveDetail
              key={props.selectedArchive?.id ?? "empty"}
              archive={props.selectedArchive}
              decisionState={props.decisionState}
              onDecision={props.onDecision}
            />
          </EdictStage>
        </section>
        <aside className={styles.recallColumn} data-shiguan-recall>
          <ReviewRecallPanel
            selectedArchive={props.selectedArchive}
            matches={props.matches}
            recallState={props.recallState}
            reviewState={props.reviewState}
            outcomes={props.outcomes}
            outcomeState={props.outcomeState}
            outcomeListState={props.outcomeListState}
            outcomeNextCursor={props.outcomeNextCursor}
            pendingOutcomeDraft={props.pendingOutcomeDraft}
            onLoadMoreOutcomes={props.onLoadMoreOutcomes}
            onRetryOutcomes={props.onRetryOutcomes}
            onRecall={props.onRecall}
            onReview={props.onReview}
            onRecordOutcome={props.onRecordOutcome}
            onRetry={props.onRetryRecall}
          />
        </aside>
      </div>
      <ShiguanInfoDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ImmersiveCourtShell>
  );
}

function ArchiveIndexPanel({
  archives,
  statistics,
  archiveState,
  statisticsState,
  selectedId,
  onSelect,
  onFilter,
  onRetryArchives,
  onRetryStatistics,
}: {
  archives: ShiguanArchive[];
  statistics: ShiguanStatistics | null;
  archiveState: ShiguanRequestViewState;
  statisticsState: ShiguanRequestViewState;
  selectedId: string | null;
  onSelect(id: string): void;
  onFilter(input: { type: string; matterType: string; department: string }): void;
  onRetryArchives(): void;
  onRetryStatistics(): void;
}) {
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onFilter({ type, matterType: query, department });
  }

  const metrics = [
    ["案卷", statistics?.total ?? "—"],
    ["当前结果 · 奏折", archives.filter((archive) => archive.type === "MEMORIAL").length],
    ["当前结果 · 回奏", archives.filter((archive) => archive.type === "REPLY").length],
    ["待复盘", statistics?.pendingReview ?? "—"],
  ];

  return (
    <section className={styles.panel} aria-labelledby="archive-index-title">
      <p className={styles.eyebrow}>Archive Index</p>
      <h2 id="archive-index-title">案卷索引</h2>

      <div className={styles.metrics}>
        {metrics.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className={styles.successMetric}>
        <span>综合成功率</span>
        <strong>{formatSuccessRate(statistics?.successRate ?? null)}</strong>
      </div>
      <StateNotice
        state={statisticsState}
        staleText="当前数字来自上次成功读取，尚未刷新。"
        onRetry={onRetryStatistics}
        retryLabel="重试统计"
      />

      <form className={styles.filterForm} onSubmit={submit}>
        <label className={styles.searchField}>
          <span className={styles.visuallyHidden}>搜索事项类型</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索案卷、事项、部门"
          />
        </label>
        <div className={styles.typeFilters} aria-label="档案类型">
          {(["", "MEMORIAL", "REPLY"] as const).map((item) => (
            <button
              key={item || "all"}
              className={type === item ? styles.typeFilterActive : styles.typeFilter}
              type="button"
              onClick={() => setType(item)}
            >
              {item === "" ? "全部" : ARCHIVE_TYPE_LABELS[item]}
            </button>
          ))}
        </div>
        <label className={styles.departmentField}>
          <span>所属部门</span>
          <input
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="全部部门"
          />
        </label>
        <button disabled={archiveState.status === "loading"} type="submit">
          {archiveState.status === "loading" ? "读取中…" : "筛选档案"}
        </button>
      </form>

      <StateNotice
        state={archiveState}
        staleText="以下为上次成功读取的档案，当前筛选尚未刷新。"
        onRetry={() => onFilter({ type, matterType: query, department })}
        retryLabel="重试档案"
      />
      {archiveState.deepLinkRetryAvailable === true && (
        <div className={styles.stateNotice}>
          <p className={styles.stateMessage} role="status">
            对应回奏尚未读取成功，可在不影响当前筛选结果的情况下重试。
          </p>
          <button className={styles.retryButton} type="button" onClick={onRetryArchives}>
            重试对应回奏
          </button>
        </div>
      )}

      {archiveState.status === "loading" && archives.length === 0 && (
        <div className={styles.loadingList} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      {archiveState.status === "empty" && (
        <p className={styles.emptyList}>没有符合当前筛选条件的真实档案。</p>
      )}
      {selectedId && archives.find((archive) => archive.id === selectedId) && (
        <CollapsedEdictScroll
          className={styles.collapsedPreview}
          title={archives.find((archive) => archive.id === selectedId)?.title ?? "当前案卷"}
          status={formatReviewStatus(
            archives.find((archive) => archive.id === selectedId)?.reviewStatus?.status ?? null,
          )}
          source="史馆案卷"
          countLabel="当前选中"
          onOpen={() => onSelect(selectedId)}
        />
      )}
      <div className={styles.archiveIndex} aria-label="当前档案">
        {archives.map((archive) => (
          <button
            key={archive.id}
            type="button"
            className={archive.id === selectedId ? styles.archiveIndexActive : styles.archiveIndexItem}
            aria-current={archive.id === selectedId ? "true" : undefined}
            onClick={() => onSelect(archive.id)}
          >
            <strong>{archive.title}</strong>
            <span>{formatArchiveType(archive.type)} · {archive.department}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ReviewRecallPanel({
  selectedArchive,
  matches,
  recallState,
  reviewState,
  onRecall,
  onReview,
  outcomes,
  outcomeState,
  outcomeListState,
  outcomeNextCursor,
  pendingOutcomeDraft,
  onLoadMoreOutcomes,
  onRetryOutcomes,
  onRecordOutcome,
  onRetry,
}: {
  selectedArchive: ShiguanArchive | null;
  matches: ShiguanRecallMatch[];
  recallState: ShiguanRequestViewState;
  reviewState: ShiguanReviewViewState;
  outcomes: ShiguanOutcomeProjection[];
  outcomeState: ShiguanOutcomeViewState;
  outcomeListState: ShiguanRequestViewState;
  outcomeNextCursor: string | null;
  pendingOutcomeDraft: FrozenOutcomeDraft | null;
  onLoadMoreOutcomes(): void;
  onRetryOutcomes(): void;
  onRecall(input: { matterType: string; department: string }): void;
  onReview(id: string, input: { status: ReviewStatusValue; note: string }): void;
  onRecordOutcome(id: string, draft: FrozenOutcomeDraft): void;
  onRetry(): void;
}) {
  const [matterType, setMatterType] = useState("");
  const [department, setDepartment] = useState("");

  return (
    <section className={styles.panel} aria-labelledby="recall-title">
      <div className={styles.panelHeading}>
        <h2 id="recall-title">复盘与召回</h2>
        <p className={styles.eyebrow}>Review &amp; Recall</p>
      </div>
      {selectedArchive === null ? (
        <div className={styles.sideEmpty}>
          <strong>选择案卷后查看复盘</strong>
          <span>右侧面板负责展示复盘状态、历史结论和相似旧案。</span>
        </div>
      ) : (
        <>
          <ShiguanReviewControl
            key={`review-${selectedArchive.id}`}
            archive={selectedArchive}
            reviewState={reviewState}
            onReview={onReview}
          />
          {/* 结果账与复盘刻意并置：取值相同、语义相反，并排展示才看得出差别。 */}
          <ShiguanOutcomePanel
            key={`outcome-${selectedArchive.id}`}
            archive={selectedArchive}
            outcomes={outcomes}
            outcomeState={outcomeState}
            outcomeListState={outcomeListState}
            outcomeNextCursor={outcomeNextCursor}
            pendingOutcomeDraft={pendingOutcomeDraft}
            onLoadMore={onLoadMoreOutcomes}
            onRetryList={onRetryOutcomes}
            onRecord={onRecordOutcome}
          />
        </>
      )}
      <h3 className={styles.sectionTitle}>相似旧案召回</h3>
      <form
        className={styles.recallForm}
        onSubmit={(event) => {
          event.preventDefault();
          onRecall({ matterType, department });
        }}
      >
        <label>
          事项类型
          <input
            value={matterType}
            onChange={(event) => setMatterType(event.target.value)}
            placeholder="如：漕运"
          />
        </label>
        <label>
          所属部门
          <input
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="如：户部"
          />
        </label>
        <button disabled={recallState.status === "loading"} type="submit">
          {recallState.status === "loading" ? "召回中…" : "召回旧案"}
        </button>
      </form>
      <StateNotice
        state={recallState}
        staleText="以下为上次成功召回的结果，本次请求尚未刷新。"
        onRetry={onRetry}
        retryLabel="重试召回"
      />

      <div className={styles.recallResults} aria-label="召回结果">
        {matches.map((match) => (
          <article key={match.archiveId} className={styles.matchCard}>
            <h3>旧案 {match.archiveId}</h3>
            <p>{match.matchReason}</p>
            <dl>
              <div>
                <dt>历史结论</dt>
                <dd>{match.historicalConclusion}</dd>
              </div>
              <div>
                <dt>证据</dt>
                <dd>{match.evidenceLabels.map(formatRealityLabel).join("、") || "未附证据"}</dd>
              </div>
              <div>
                <dt>复盘</dt>
                <dd>{formatReviewStatus(match.reviewStatus?.status ?? null)}</dd>
              </div>
              {match.reviewStatus && (
                <div>
                  <dt>复盘时间</dt>
                  <dd><time dateTime={match.reviewStatus.reviewedAt}>{formatBusinessTime(match.reviewStatus.reviewedAt)}</time></dd>
                </div>
              )}
            </dl>
            {match.reviewStatus?.note && <p>备注：{match.reviewStatus.note}</p>}
            {match.lessonsLearned && <p className={styles.lesson}>经验：{match.lessonsLearned}</p>}
            {match.pitfalls && <p className={styles.pitfall}>教训：{match.pitfalls}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function ShiguanInfoDrawer({ open, onClose }: { open: boolean; onClose(): void }) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  const sections = useMemo(() => [
    ["案卷范围", "史馆仅收录当前用户拥有的真实奏折与办理回奏，不以演示档案补位。"],
    ["复盘留痕", "复盘状态与备注写回当前案卷；提交前请核对事实依据。"],
    ["旧案召回", "按事项类型或所属部门召回相似旧案，结果不自动推断为已达成。"],
    ["可信边界", "证据真实度、历史结论与召回原因均按真实接口返回内容展示。"],
  ], []);

  return (
    <>
      <button
        className={open ? styles.drawerBackdropOpen : styles.drawerBackdrop}
        type="button"
        aria-label="关闭史馆说明"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        className={open ? styles.drawerOpen : styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shiguan-drawer-title"
        aria-hidden={!open}
      >
        <header>
          <div>
            <p>SHIGUAN GUIDE</p>
            <h2 id="shiguan-drawer-title">史馆说明</h2>
          </div>
          <button type="button" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <div className={styles.drawerBody}>
          {sections.map(([title, body]) => (
            <section key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}

function StateNotice({
  state,
  staleText,
  onRetry,
  retryLabel,
  showRetry = true,
}: {
  state: ShiguanRequestViewState;
  staleText: string;
  onRetry(): void;
  retryLabel: string;
  showRetry?: boolean;
}) {
  return (
    <div className={styles.stateNotice}>
      <p
        className={state.status === "error" ? styles.errorMessage : styles.stateMessage}
        role={state.status === "error" ? "alert" : "status"}
      >
        {state.message}
        {state.stale ? ` ${staleText}` : ""}
      </p>
      {state.status === "error" && showRetry && (
        <button className={styles.retryButton} type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
