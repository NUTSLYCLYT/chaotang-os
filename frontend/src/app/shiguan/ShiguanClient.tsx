"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { ChaotangHeader } from "../../components/chaotang/ChaotangHeader";
import { EdictScrollShell } from "../../components/chaotang/EdictScrollShell";
import type {
  ArchiveType,
  ReviewStatusValue,
  ShiguanArchive,
  ShiguanRecallMatch,
  ShiguanReviewStatus,
  ShiguanStatistics,
} from "../../lib/backendClient.ts";
import {
  ARCHIVE_TYPE_LABELS,
  buildArchiveFilterQuery,
  formatArchiveType,
  formatRealityLabel,
  formatReviewStatus,
  formatSuccessRate,
  REVIEW_STATUS_LABELS,
} from "./archiveStatus.ts";
import styles from "./shiguan.module.css";

const ARCHIVE_TYPES: ArchiveType[] = [
  "MEMORIAL",
  "REPLY",
];
const REVIEW_STATUSES: ReviewStatusValue[] = [
  "ACHIEVED",
  "NOT_ACHIEVED",
  "PARTIAL",
  "OBSERVING",
];

interface ArchivesResponse {
  status: "ok";
  archives: ShiguanArchive[];
}

interface StatisticsResponse {
  status: "ok";
  statistics: ShiguanStatistics;
}

interface RecallResponse {
  status: "ok";
  matches: ShiguanRecallMatch[];
}

interface ReviewResponse {
  status: "ok";
  reviewStatus: ShiguanReviewStatus;
}

interface ErrorResponse {
  status: "error";
  message: string;
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    window.setTimeout(() => window.location.assign("/login?next=%2Fshiguan"), 0);
    throw new Error("会话已过期，正在返回登录页。");
  }
  let body: T | ErrorResponse;
  try {
    body = (await response.json()) as T | ErrorResponse;
  } catch {
    throw new Error("史馆服务返回了无法识别的响应，请稍后重试");
  }
  if (!response.ok) {
    const errorBody = body as Partial<ErrorResponse>;
    throw new Error(typeof errorBody.message === "string" ? errorBody.message : "史馆请求失败");
  }
  return body as T;
}

function displayDate(value: string | null): string {
  if (value === null) {
    return "未记录";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

function stableUiError(error: unknown): string {
  return error instanceof Error && /[\u3400-\u9fff]/u.test(error.message)
    ? error.message
    : "史馆请求失败，请稍后重试";
}

function ArchiveCard({
  archive,
  onReviewed,
}: {
  archive: ShiguanArchive;
  onReviewed: (archiveId: string, reviewStatus: ShiguanReviewStatus) => void;
}) {
  const [status, setStatus] = useState<ReviewStatusValue>(
    archive.reviewStatus?.status ?? "OBSERVING",
  );
  const [note, setNote] = useState(archive.reviewStatus?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/shiguan/archives/${archive.id}/review`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const body = await readJson<ReviewResponse>(response);
      onReviewed(archive.id, body.reviewStatus);
      setMessage({ text: "复盘已更新", error: false });
    } catch (error) {
      setMessage({ text: stableUiError(error), error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={styles.archiveCard}>
      <div className={styles.archiveCardHead}>
        <div>
          <p className={styles.archiveMeta}>
            {formatArchiveType(archive.type)} · {archive.department} · {archive.matterType}
          </p>
          <h2>{archive.title}</h2>
        </div>
        <span className={styles.statusBadge}>
          {formatReviewStatus(archive.reviewStatus?.status ?? null)}
        </span>
      </div>

      <p className={styles.archiveContent}>{archive.content}</p>

      <dl className={styles.archiveDetails}>
        <div>
          <dt>归档时间</dt>
          <dd>{displayDate(archive.createdAt)}</dd>
        </div>
        <div>
          <dt>证据来源形态</dt>
          <dd>
            {archive.evidence.length === 0
              ? "未附证据"
              : archive.evidence
                  .map((evidence) => `${formatRealityLabel(evidence.realityLabel)}：${evidence.source}`)
                  .join("；")}
          </dd>
        </div>
        {archive.type === "REPLY" && archive.sourceKind && archive.sourceText && (
          <div>
            <dt>回奏来源</dt>
            <dd>{archive.sourceKind}：{archive.sourceText}</dd>
          </div>
        )}
        {archive.type === "REPLY" && archive.participatingDepartments && (
          <div>
            <dt>参与部门</dt>
            <dd>{archive.participatingDepartments.join("、")}</dd>
          </div>
        )}
        {archive.type === "REPLY" && archive.replyProcess && (
          <div>
            <dt>回奏过程</dt>
            <dd>{archive.replyProcess}</dd>
          </div>
        )}
        {archive.type === "REPLY" && archive.replyConclusion && (
          <div>
            <dt>回奏结论</dt>
            <dd>{archive.replyConclusion}</dd>
          </div>
        )}
        {archive.type === "REPLY" && archive.replyTime && (
          <div>
            <dt>回奏时间</dt>
            <dd>{displayDate(archive.replyTime)}</dd>
          </div>
        )}
        {archive.type === "REPLY" && archive.respondent && (
          <div>
            <dt>答复者</dt>
            <dd>{archive.respondent}</dd>
          </div>
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
              {formatReviewStatus(archive.reviewStatus.status)} · {displayDate(archive.reviewStatus.reviewedAt)}
              {archive.reviewStatus.note ? ` · ${archive.reviewStatus.note}` : ""}
            </dd>
          </div>
        )}
      </dl>

      {archive.evidenceReferences.length > 0 && (
        <section className={styles.evidenceSection}>
          <h3>采用证据快照</h3>
          <ul className={styles.evidenceList}>
            {archive.evidenceReferences.map((reference) => {
              const snapshot = reference.snapshot;
              return (
                <li
                  className={styles.evidenceItem}
                  key={`${reference.packId}-${reference.ordinal}`}
                >
                  <p>
                    <strong>
                      {snapshot.factKey} · {snapshot.category} · {snapshot.dataScope}
                    </strong>
                  </p>
                  <p>
                    {snapshot.subject}
                    {snapshot.jurisdiction ? ` · ${snapshot.jurisdiction}` : ""}
                    {" · "}
                    {snapshot.sourceType === "MCP"
                      ? "批准的只读 MCP"
                      : snapshot.sourceType}
                  </p>
                  <p>{snapshot.excerpt}</p>
                  <p>
                    <a href={snapshot.sourceUrl} rel="noreferrer" target="_blank">
                      查看证据出处
                    </a>
                    {snapshot.accessUrl && (
                      <>
                        {" · "}
                        <a
                          href={snapshot.accessUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          查看访问溯源
                        </a>
                      </>
                    )}
                  </p>
                  {snapshot.accessMetadata && (
                    <details>
                      <summary>访问元数据</summary>
                      <pre>
                        {JSON.stringify(snapshot.accessMetadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <form className={styles.reviewForm} onSubmit={submitReview}>
        <label>
          结果复盘
          <select
            className={styles.control}
            value={status}
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
          备注
          <input
            className={styles.control}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="记录复盘依据或后续观察点"
          />
        </label>
        <button
          className={styles.actionButton}
          disabled={saving}
          type="submit"
        >
          {saving ? "更新中…" : "更新复盘"}
        </button>
        {message && (
          <p
            className={styles.formMessage}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}
      </form>
    </article>
  );
}

export function ShiguanClient() {
  const [type, setType] = useState("");
  const [matterType, setMatterType] = useState("");
  const [department, setDepartment] = useState("");
  const [archives, setArchives] = useState<ShiguanArchive[]>([]);
  const [statistics, setStatistics] = useState<ShiguanStatistics | null>(null);
  const [archiveMessage, setArchiveMessage] = useState("正在读取史馆…");
  const [archiveError, setArchiveError] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [recallMatterType, setRecallMatterType] = useState("");
  const [recallDepartment, setRecallDepartment] = useState("");
  const [matches, setMatches] = useState<ShiguanRecallMatch[]>([]);
  const [recallMessage, setRecallMessage] = useState("可按事项类型或所属部门召回旧案。");
  const [recallError, setRecallError] = useState(false);
  const [recallLoading, setRecallLoading] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);

  const query = useMemo(
    () => buildArchiveFilterQuery({ type, matterType, department, limit: 100 }),
    [department, matterType, type],
  );

  async function loadArchives() {
    setArchiveLoading(true);
    setArchiveError(false);
    setArchiveMessage("正在读取史馆…");
    try {
      const [archivesResponse, statisticsResponse] = await Promise.all([
        fetch(`/api/shiguan/archives?${query}`),
        fetch("/api/shiguan/statistics"),
      ]);
      const archiveBody = await readJson<ArchivesResponse>(archivesResponse);
      const statisticsBody = await readJson<StatisticsResponse>(statisticsResponse);
      setArchives(archiveBody.archives);
      setStatistics(statisticsBody.statistics);
      setArchiveMessage(archiveBody.archives.length === 0 ? "没有命中档案。" : "史馆已更新。");
    } catch (error) {
      setArchiveError(true);
      setArchiveMessage(stableUiError(error));
    } finally {
      setArchiveLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialArchives() {
      try {
        const [archivesResponse, statisticsResponse] = await Promise.all([
          fetch("/api/shiguan/archives?limit=100"),
          fetch("/api/shiguan/statistics"),
        ]);
        const archiveBody = await readJson<ArchivesResponse>(archivesResponse);
        const statisticsBody = await readJson<StatisticsResponse>(statisticsResponse);
        if (cancelled) {
          return;
        }
        setArchives(archiveBody.archives);
        setStatistics(statisticsBody.statistics);
        setArchiveMessage(archiveBody.archives.length === 0 ? "没有命中档案。" : "史馆已更新。");
      } catch (error) {
        if (!cancelled) {
          setArchiveError(true);
          setArchiveMessage(stableUiError(error));
        }
      } finally {
        if (!cancelled) setArchiveLoading(false);
      }
    }

    void loadInitialArchives();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadArchives();
  }

  async function submitRecall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecallLoading(true);
    setRecallError(false);
    setRecallMessage("正在召回旧案…");
    try {
      const response = await fetch("/api/shiguan/recall", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matterType: recallMatterType,
          department: recallDepartment,
          limit: 10,
        }),
      });
      const body = await readJson<RecallResponse>(response);
      setMatches(body.matches);
      setRecallMessage(body.matches.length === 0 ? "未命中旧案。" : "旧案召回完成。");
    } catch (error) {
      setRecallError(true);
      setRecallMessage(stableUiError(error));
    } finally {
      setRecallLoading(false);
    }
  }

  function onReviewed(archiveId: string, reviewStatus: ShiguanReviewStatus) {
    setArchives((current) =>
      current.map((archive) => (archive.id === archiveId ? { ...archive, reviewStatus } : archive)),
    );
    void loadArchives();
  }

  const selectedArchive = archives.find((archive) => archive.id === selectedArchiveId) ?? archives[0] ?? null;

  return (
    <main className={styles.page}>
      <ChaotangHeader currentLabel="太史馆" currentPath="/shiguan" />
      <div className={styles.workspace}>
        <div className={styles.inner}>
          <header className={styles.identity}>
            <p>Shiguan Memory Router</p>
            <h1>太史馆</h1>
            <span>归档、复盘、旧案召回与可信留痕</span>
          </header>
          <section className={styles.threeColumn}>
            <aside className={styles.archiveColumn}>
              <section className={styles.panel}>
                <p className={styles.panelEyebrow}>Archive Index</p>
                <h2>案卷索引</h2>
                <div className={styles.metrics}>
                  {[
                    ["档案", statistics?.total ?? "—"],
                    ["成功率", formatSuccessRate(statistics?.successRate ?? null)],
                    ["待复盘", statistics?.pendingReview ?? "—"],
                    ["达成", statistics?.achieved ?? "—"],
                    ["未达成", statistics?.notAchieved ?? "—"],
                    ["部分达成", statistics?.partial ?? "—"],
                    ["持续观察", statistics?.observing ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label}><span>{label}</span><strong>{value}</strong></div>
                  ))}
                </div>
                <form className={styles.filterForm} onSubmit={submitFilter}>
                  <label>
                    档案类型
                    <select className={styles.control} value={type} onChange={(event) => setType(event.target.value)}>
                      <option value="">全部</option>
                      {ARCHIVE_TYPES.map((item) => <option key={item} value={item}>{ARCHIVE_TYPE_LABELS[item]}</option>)}
                    </select>
                  </label>
                  <label>
                    事项类型
                    <input className={styles.control} value={matterType} onChange={(event) => setMatterType(event.target.value)} placeholder="如：漕运、财政" />
                  </label>
                  <label>
                    所属部门
                    <input className={styles.control} value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="如：户部" />
                  </label>
                  <button className={styles.actionButton} disabled={archiveLoading} type="submit">{archiveLoading ? "筛选中…" : "筛选档案"}</button>
                  <p className={styles.formMessage} role={archiveError ? "alert" : "status"}>{archiveMessage}</p>
                </form>
                <div className={styles.archiveIndex} aria-label="当前档案">
                  {archives.map((archive) => (
                    <button key={archive.id} className={archive.id === selectedArchive?.id ? styles.archiveIndexActive : styles.archiveIndexItem} type="button" onClick={() => setSelectedArchiveId(archive.id)}>
                      <strong>{archive.title}</strong>
                      <span>{formatArchiveType(archive.type)} · {archive.department}</span>
                    </button>
                  ))}
                </div>
              </section>
            </aside>
            <section className={styles.scrollColumn}>
              <EdictScrollShell>
                <div className={styles.scrollHeading}>
                  <p>太史令 · 史馆中卷</p>
                  <h2>史馆案卷</h2>
                  <span>事实、证据与复盘留痕</span>
                </div>
                {selectedArchive ? <ArchiveCard key={selectedArchive.id} archive={selectedArchive} onReviewed={onReviewed} /> : (
                  <div className={styles.emptyState}><h3>暂无真实档案</h3><p>当前没有符合条件的真实归档。真实奏折与办理回奏归档后，会进入史馆形成可检索案卷。</p></div>
                )}
              </EdictScrollShell>
            </section>
            <aside className={styles.reviewColumn}>
              <section className={styles.panel}>
                <p className={styles.panelEyebrow}>Review &amp; Recall</p>
                <h2>旧案召回</h2>
                <p className={styles.panelLead}>
            史馆仅归档真实奏折与办理回奏；保留证据真实度、结果复盘与旧案召回，避免把演示内容误当真实事实。
                </p>
                <form className={styles.recallForm} onSubmit={submitRecall}>
                  <label htmlFor="recall-matter-type">
                事项类型
                <input
                  id="recall-matter-type"
                  className={styles.control}
                  value={recallMatterType}
                  onChange={(event) => setRecallMatterType(event.target.value)}
                  placeholder="如：漕运"
                />
              </label>
                  <label htmlFor="recall-department">
                所属部门
                <input
                  id="recall-department"
                  className={styles.control}
                  value={recallDepartment}
                  onChange={(event) => setRecallDepartment(event.target.value)}
                  placeholder="如：户部"
                />
              </label>
                  <button className={styles.actionButton} disabled={recallLoading} type="submit">
                {recallLoading ? "召回中…" : "召回旧案"}
              </button>
                </form>
                <p className={styles.formMessage} role={recallError ? "alert" : "status"}>{recallMessage}</p>
                <div className={styles.recallResults}>
              {matches.map((match) => (
                  <article key={match.archiveId} className={styles.matchCard}>
                  <h3>旧案 {match.archiveId}</h3>
                  <p>{match.matchReason}</p>
                  <p>历史结论：{match.historicalConclusion}</p>
                  <p>
                    证据：{match.evidenceLabels.map(formatRealityLabel).join("、") || "未附证据"}；
                    复盘：{formatReviewStatus(match.reviewStatus?.status ?? null)}
                  </p>
                  {match.reviewStatus && (
                    <p>
                      复盘时间：{displayDate(match.reviewStatus.reviewedAt)}
                      {match.reviewStatus.note ? `；备注：${match.reviewStatus.note}` : ""}
                    </p>
                  )}
                  {match.lessonsLearned && (
                    <p className={styles.lesson}>经验：{match.lessonsLearned}</p>
                  )}
                  {match.pitfalls && (
                    <p className={styles.pitfall}>教训：{match.pitfalls}</p>
                  )}
                </article>
              ))}
                </div>
              </section>
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}
