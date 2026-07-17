"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

const ARCHIVE_TYPES: ArchiveType[] = [
  "MEMORIAL",
  "DECISION",
  "TASK_RESULT",
  "KNOWLEDGE",
  "PUBLICITY",
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
  const body = (await response.json()) as T | ErrorResponse;
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
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage("复盘已更新");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {formatArchiveType(archive.type)} · {archive.department} · {archive.matterType}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{archive.title}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
          {formatReviewStatus(archive.reviewStatus?.status ?? null)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-slate-700">{archive.content}</p>

      <dl className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-900">归档时间</dt>
          <dd>{displayDate(archive.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">证据真实度</dt>
          <dd>
            {archive.evidence.length === 0
              ? "未附证据"
              : archive.evidence
                  .map((evidence) => `${formatRealityLabel(evidence.realityLabel)}：${evidence.source}`)
                  .join("；")}
          </dd>
        </div>
        {archive.decisionConclusion && (
          <div>
            <dt className="font-medium text-slate-900">决策结论</dt>
            <dd>{archive.decisionConclusion}</dd>
          </div>
        )}
        {archive.responsibleOwner && (
          <div>
            <dt className="font-medium text-slate-900">责任主体</dt>
            <dd>{archive.responsibleOwner}</dd>
          </div>
        )}
        {archive.lessonsLearned && (
          <div>
            <dt className="font-medium text-slate-900">历史经验</dt>
            <dd>{archive.lessonsLearned}</dd>
          </div>
        )}
        {archive.pitfalls && (
          <div>
            <dt className="font-medium text-slate-900">踩坑教训</dt>
            <dd>{archive.pitfalls}</dd>
          </div>
        )}
      </dl>

      <form className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4" onSubmit={submitReview}>
        <label className="grid gap-1 text-sm">
          结果复盘
          <select
            className="rounded-lg border border-slate-300 px-3 py-2"
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
        <label className="min-w-64 flex-1 grid gap-1 text-sm">
          备注
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="记录复盘依据或后续观察点"
          />
        </label>
        <button
          className="rounded-lg bg-slate-950 px-4 py-2 text-white disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? "更新中…" : "更新复盘"}
        </button>
        {message && <p className="basis-full text-sm text-slate-600">{message}</p>}
      </form>
    </article>
  );
}

export default function ShiguanPage() {
  const [type, setType] = useState("");
  const [matterType, setMatterType] = useState("");
  const [department, setDepartment] = useState("");
  const [archives, setArchives] = useState<ShiguanArchive[]>([]);
  const [statistics, setStatistics] = useState<ShiguanStatistics | null>(null);
  const [archiveMessage, setArchiveMessage] = useState("正在读取史馆…");
  const [recallMatterType, setRecallMatterType] = useState("");
  const [recallDepartment, setRecallDepartment] = useState("");
  const [matches, setMatches] = useState<ShiguanRecallMatch[]>([]);
  const [recallMessage, setRecallMessage] = useState("可按事项类型或所属部门召回旧案。");

  const query = useMemo(
    () => buildArchiveFilterQuery({ type, matterType, department, limit: 100 }),
    [department, matterType, type],
  );

  async function loadArchives() {
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
      setArchiveMessage(error instanceof Error ? error.message : String(error));
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
          setArchiveMessage(error instanceof Error ? error.message : String(error));
        }
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
      setRecallMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function onReviewed(archiveId: string, reviewStatus: ShiguanReviewStatus) {
    setArchives((current) =>
      current.map((archive) => (archive.id === archiveId ? { ...archive, reviewStatus } : archive)),
    );
    void loadArchives();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="text-sm font-medium text-slate-500">Hall of Records</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">史馆</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            统一归档奏折、决策、任务结果、知识条目和宣传材料；保留证据真实度、决策留痕、结果复盘与旧案召回，避免把演示内容误当真实事实。
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-5">
          {[
            ["档案总数", statistics?.total ?? "—"],
            ["成功率", formatSuccessRate(statistics?.successRate ?? null)],
            ["待复盘", statistics?.pendingReview ?? "—"],
            ["达成", statistics?.achieved ?? "—"],
            ["持续观察", statistics?.observing ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <form className="grid gap-4 md:grid-cols-5" onSubmit={submitFilter}>
            <label className="grid gap-1 text-sm">
              档案类型
              <select
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="">全部</option>
                {ARCHIVE_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {ARCHIVE_TYPE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              事项类型
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={matterType}
                onChange={(event) => setMatterType(event.target.value)}
                placeholder="如：漕运、财政"
              />
            </label>
            <label className="grid gap-1 text-sm">
              所属部门
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="如：户部"
              />
            </label>
            <button className="self-end rounded-lg bg-slate-950 px-4 py-2 text-white" type="submit">
              筛选档案
            </button>
            <p className="self-end text-sm text-slate-600">{archiveMessage}</p>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            {archives.map((archive) => (
              <ArchiveCard key={archive.id} archive={archive} onReviewed={onReviewed} />
            ))}
          </div>

          <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">旧案召回</h2>
            <p className="mt-2 text-sm text-slate-600">
              按事项类型或所属部门寻找相似案例，把历史经验和踩坑教训反馈给后续决策。
            </p>
            <form className="mt-4 grid gap-3" onSubmit={submitRecall}>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={recallMatterType}
                onChange={(event) => setRecallMatterType(event.target.value)}
                placeholder="事项类型"
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={recallDepartment}
                onChange={(event) => setRecallDepartment(event.target.value)}
                placeholder="所属部门"
              />
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-white" type="submit">
                召回旧案
              </button>
            </form>
            <p className="mt-3 text-sm text-slate-600">{recallMessage}</p>
            <div className="mt-4 space-y-3">
              {matches.map((match) => (
                <article key={match.archiveId} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm text-slate-500">
                    {match.department} · {match.matterType}
                  </p>
                  <h3 className="font-semibold">{match.title}</h3>
                  <p className="mt-1 text-sm text-slate-700">{match.matchReason}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    证据：{match.evidenceLabels.map(formatRealityLabel).join("、") || "未附证据"}；
                    复盘：{formatReviewStatus(match.reviewStatus)}
                  </p>
                  {match.lessonsLearned && (
                    <p className="mt-2 text-sm text-emerald-700">经验：{match.lessonsLearned}</p>
                  )}
                  {match.pitfalls && (
                    <p className="mt-1 text-sm text-amber-700">教训：{match.pitfalls}</p>
                  )}
                </article>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
