"use client";

import { useEffect, useState } from "react";
import type { DadianOverview } from "../../lib/backendClient";
import styles from "./dadian.module.css";

type OverviewResponse = { status: "ok"; overview: DadianOverview };
const NO_SUGGESTION = "暂无建议";

export function DadianOverviewClient() {
  const [department, setDepartment] = useState("");
  const [overview, setOverview] = useState<DadianOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const query = department ? `?department=${encodeURIComponent(department)}` : "";
    fetch(`/api/dadian/overview${query}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) { window.location.assign("/login?next=%2Fdadian"); throw new Error("authentication required"); }
        const body = await response.json() as OverviewResponse | { message?: string };
        if (!response.ok || !("status" in body) || body.status !== "ok") throw new Error("message" in body ? body.message : "大殿概览暂时不可用，请稍后重试。");
        return body.overview;
      })
      .then((data) => { if (!cancelled) setOverview(data); })
      .catch((reason: unknown) => { if (!cancelled && !(reason instanceof Error && reason.message === "authentication required")) setError("大殿概览暂时不可用，请稍后重试。"); });
    return () => { cancelled = true; };
  }, [department, retry]);
  return <main className={styles.overview}>
    <h1>大殿回奏总览</h1>
    <label>参与部门 <select value={department} onChange={(event) => { setError(null); setDepartment(event.target.value); }}><option value="">全部</option>{overview?.departmentCounts.map((item) => <option key={item.department} value={item.department}>{item.department}（{item.count}）</option>)}</select></label>
    {error ? <section><p>{error}</p><button onClick={() => { setError(null); setRetry((value) => value + 1); }}>重试</button></section> : !overview ? <p>正在读取真实回奏…</p> : <>
      <section className={styles.metrics}><p>已归档回奏 <strong>{overview.replyCount}</strong></p><p>待复盘 <strong>{overview.pendingReviewCount}</strong></p><p>今日要务：{overview.todayFocus === NO_SUGGESTION ? NO_SUGGESTION : overview.todayFocus}</p></section>
      <section><h2>最新回奏</h2>{overview.recentReplies.length === 0 ? <p>暂无真实回奏。</p> : <ul>{overview.recentReplies.map((reply) => <li key={reply.id}><strong>{reply.title}</strong><p>{reply.replyConclusion}</p><small>{reply.respondent} · {reply.participatingDepartments.join("、")}</small></li>)}</ul>}</section>
    </>}
  </main>;
}
