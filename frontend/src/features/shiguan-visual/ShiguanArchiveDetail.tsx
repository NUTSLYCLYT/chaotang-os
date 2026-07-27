"use client";

import { useState } from "react";

import type {
  ReviewStatusValue,
  ShiguanArchive,
} from "../../lib/backendClient.ts";
import {
  formatArchiveType,
  formatRealityLabel,
  formatReviewStatus,
  REVIEW_STATUS_LABELS,
} from "../../app/shiguan/archiveStatus.ts";
import type { ShiguanReviewViewState } from "./ShiguanWorkspace";
import styles from "./ShiguanWorkspace.module.css";

const REVIEW_STATUSES: ReviewStatusValue[] = [
  "ACHIEVED",
  "NOT_ACHIEVED",
  "PARTIAL",
  "OBSERVING",
];

function displayDate(value: string | null): string {
  if (value === null) {
    return "未记录";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

export function ShiguanArchiveDetail({
  archive,
}: {
  archive: ShiguanArchive | null;
}) {
  if (archive === null) {
    return (
      <section className={styles.emptyDetail} data-empty-state>
        <p className={styles.scrollKicker}>ARCHIVE CASE</p>
        <h2>暂无真实档案</h2>
        <p>真实奏折与办理回奏归档后会显示在这里，不以演示记录填充空位。</p>
      </section>
    );
  }

  return (
    <article className={styles.archiveDetail} data-archive-type={archive.type}>
      <header className={styles.detailHeader}>
        <div>
          <p className={styles.scrollKicker}>太史令 · 史馆中卷</p>
          <p className={styles.archiveMeta}>
            {formatArchiveType(archive.type)} · {archive.department} · {archive.matterType}
          </p>
          <h2>{archive.title}</h2>
        </div>
        <span className={styles.statusBadge}>
          {formatReviewStatus(archive.reviewStatus?.status ?? null)}
        </span>
      </header>

      <p className={styles.archiveContent}>{archive.content}</p>

      <dl className={styles.archiveFacts}>
        <div>
          <dt>归档时间</dt>
          <dd>{displayDate(archive.createdAt)}</dd>
        </div>
        <div>
          <dt>证据来源</dt>
          <dd>
            {archive.evidence.length === 0
              ? "未附证据"
              : archive.evidence
                  .map((evidence) => (
                    `${formatRealityLabel(evidence.realityLabel)}：${evidence.source}` +
                    (evidence.note ? `（${evidence.note}）` : "")
                  ))
                  .join("；")}
          </dd>
        </div>
        {archive.type === "REPLY" && (
          <>
            <div>
              <dt>回奏来源</dt>
              <dd>
                {archive.sourceKind && archive.sourceText
                  ? `${archive.sourceKind}：${archive.sourceText}`
                  : "未记录"}
              </dd>
            </div>
            <div>
              <dt>参与部门</dt>
              <dd>{archive.participatingDepartments?.join("、") || "未记录"}</dd>
            </div>
            <div>
              <dt>办理过程</dt>
              <dd>{archive.replyProcess || "未记录"}</dd>
            </div>
            <div>
              <dt>回奏结论</dt>
              <dd>{archive.replyConclusion || "未记录"}</dd>
            </div>
            <div>
              <dt>回奏时间</dt>
              <dd>{displayDate(archive.replyTime)}</dd>
            </div>
            <div>
              <dt>答复者</dt>
              <dd>{archive.respondent || "未记录"}</dd>
            </div>
          </>
        )}
        {archive.lessonsLearned && (
          <div>
            <dt>历史经验</dt>
            <dd>{archive.lessonsLearned}</dd>
          </div>
        )}
        {archive.pitfalls && (
          <div>
            <dt>踩坑教训</dt>
            <dd>{archive.pitfalls}</dd>
          </div>
        )}
        {archive.reviewStatus && (
          <div>
            <dt>复盘留痕</dt>
            <dd>
              {formatReviewStatus(archive.reviewStatus.status)} ·{" "}
              {displayDate(archive.reviewStatus.reviewedAt)}
              {archive.reviewStatus.note ? ` · ${archive.reviewStatus.note}` : ""}
            </dd>
          </div>
        )}
      </dl>

      <section className={styles.evidenceReferences} aria-label="采用证据快照">
        <h3>采用证据快照</h3>
        {archive.evidenceReferences.length === 0 ? (
          <p>本案卷未附不可变证据快照。</p>
        ) : (
          <ol>
            {archive.evidenceReferences.map((reference) => {
              const { snapshot } = reference;
              const serverId = snapshot.sourceType === "MCP" &&
                typeof snapshot.accessMetadata?.serverId === "string"
                ? snapshot.accessMetadata.serverId
                : null;
              const toolName = snapshot.sourceType === "MCP" &&
                typeof snapshot.accessMetadata?.toolName === "string"
                ? snapshot.accessMetadata.toolName
                : null;
              return (
                <li key={`${reference.packId}-${reference.investigationId}-${reference.ordinal}`}>
                  <h4>{snapshot.factKey}</h4>
                  <dl>
                    <div><dt>事实主体</dt><dd>{snapshot.subject}</dd></div>
                    <div><dt>事实分类</dt><dd>{snapshot.category}</dd></div>
                    <div><dt>数据范围</dt><dd>{snapshot.dataScope}</dd></div>
                    <div><dt>司法辖区</dt><dd>{snapshot.jurisdiction ?? "未记录"}</dd></div>
                    <div><dt>事实值</dt><dd>{JSON.stringify(snapshot.value)}</dd></div>
                    <div><dt>单位</dt><dd>{snapshot.unit ?? "未记录"}</dd></div>
                    <div><dt>数据时点</dt><dd>{displayDate(snapshot.asOf)}</dd></div>
                    <div><dt>发布时间</dt><dd>{displayDate(snapshot.publishedAt)}</dd></div>
                    <div><dt>取证时间</dt><dd>{displayDate(snapshot.retrievedAt)}</dd></div>
                    <div><dt>发布方</dt><dd>{snapshot.publisher}</dd></div>
                    <div><dt>来源类型</dt><dd>{snapshot.sourceType}</dd></div>
                    <div><dt>覆盖范围</dt><dd>{snapshot.coverage?.join("、") || "未记录"}</dd></div>
                    <div><dt>许可说明</dt><dd>{snapshot.licenseNote ?? "未记录"}</dd></div>
                    <div><dt>证据质量</dt><dd>{snapshot.quality}</dd></div>
                    <div><dt>证据立场</dt><dd>{snapshot.stance}</dd></div>
                    <div><dt>置信度</dt><dd>{snapshot.confidence}</dd></div>
                    <div><dt>内容哈希</dt><dd>{snapshot.contentHash}</dd></div>
                    <div><dt>证据包</dt><dd>{reference.packId}</dd></div>
                    <div><dt>调查编号</dt><dd>{reference.investigationId}</dd></div>
                    <div><dt>证据标识</dt><dd>{reference.evidenceId}</dd></div>
                    <div><dt>引用序号</dt><dd>{reference.ordinal}</dd></div>
                    <div><dt>快照校验</dt><dd>{reference.snapshotHash}</dd></div>
                  </dl>
                  <p>{snapshot.excerpt}</p>
                  <p className={styles.evidenceLinks}>
                    <a href={snapshot.sourceUrl} rel="noreferrer" target="_blank">查看证据出处</a>
                    {snapshot.accessUrl && (
                      <a href={snapshot.accessUrl} rel="noreferrer" target="_blank">查看访问溯源</a>
                    )}
                  </p>
                  {snapshot.sourceType === "MCP" && (serverId || toolName) && (
                    <p className={styles.mcpProvenance}>
                      MCP 溯源
                      {serverId ? ` · server: ${serverId}` : ""}
                      {toolName ? ` · tool: ${toolName}` : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </article>
  );
}

export function ShiguanReviewControl({
  archive,
  reviewState,
  onReview,
}: {
  archive: ShiguanArchive;
  reviewState: ShiguanReviewViewState;
  onReview(id: string, input: { status: ReviewStatusValue; note: string }): void;
}) {
  const [status, setStatus] = useState<ReviewStatusValue>(
    archive.reviewStatus?.status ?? "OBSERVING",
  );
  const [note, setNote] = useState(archive.reviewStatus?.note ?? "");
  const showReviewState = reviewState.archiveId === archive.id;
  const isSaving = showReviewState && reviewState.status === "loading";

  return (
    <section className={styles.reviewCard} aria-label="案卷复盘">
      <div className={styles.reviewCardHeading}>
        <div>
          <span>RETROSPECTIVE</span>
          <strong>复盘状态：{formatReviewStatus(archive.reviewStatus?.status ?? null)}</strong>
        </div>
        <span className={styles.statusBadge}>
          {archive.evidence.length > 0
            ? formatRealityLabel(archive.evidence[0].realityLabel)
            : "未附证据"}
        </span>
      </div>
      <form
        className={styles.reviewForm}
        onSubmit={(event) => {
          event.preventDefault();
          onReview(archive.id, { status, note });
        }}
      >
        <label>
          结果复盘
          <select
            value={status}
            disabled={isSaving}
            onChange={(event) => setStatus(event.target.value as ReviewStatusValue)}
          >
            {REVIEW_STATUSES.map((item) => (
              <option key={item} value={item}>
                {REVIEW_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.reviewNote}>
          复盘备注
          <textarea
            value={note}
            disabled={isSaving}
            onChange={(event) => setNote(event.target.value)}
            placeholder="记录复盘依据或后续观察点"
            rows={2}
          />
        </label>
        <button disabled={isSaving} type="submit">
          {isSaving
            ? "更新中…"
            : showReviewState && reviewState.status === "error"
              ? "重试复盘"
              : "更新复盘"}
        </button>
        {showReviewState && (
          <p
            className={reviewState.status === "error" ? styles.reviewError : styles.reviewMessage}
            role={reviewState.status === "error" ? "alert" : "status"}
          >
            {reviewState.message}
          </p>
        )}
      </form>
    </section>
  );
}
