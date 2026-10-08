"use client";

import { useState, type ChangeEvent } from "react";
import type { JinyiweiNewsPreview } from "../../lib/backendClient";
import styles from "./JinyiweiNewsDesk.module.css";

const EVENT_LABELS = { SINGLE_SOURCE: "单一来源", MULTI_SOURCE: "多来源", CONFLICTED: "内容冲突" } as const;

type ImportState = { phase: "idle" | "loading" | "error"; message?: string };

function isPreview(value: unknown): value is JinyiweiNewsPreview {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.snapshotId === "string"
    && typeof record.rulesVersion === "string"
    && Array.isArray(record.articles)
    && Array.isArray(record.events)
    && Array.isArray(record.rejected)
    && typeof record.doNotInfer === "string";
}

export function JinyiweiNewsDesk({ preview }: { preview: JinyiweiNewsPreview | null }) {
  const [currentPreview, setCurrentPreview] = useState(preview);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });

  async function importSnapshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportState({ phase: "loading" });
    try {
      const input: unknown = JSON.parse(await file.text());
      const response = await fetch("/api/jinyiwei/news", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
        ? body.message
        : "离线快照预览暂时不可用，请检查文件格式后重试。";
      if (!response.ok || typeof body !== "object" || body === null || !("news" in body) || !isPreview(body.news)) {
        throw new Error(message);
      }
      setCurrentPreview(body.news);
      setImportState({ phase: "idle" });
    } catch (error) {
      setImportState({ phase: "error", message: error instanceof SyntaxError ? "JSON 文件无法解析，请选择有效的离线快照。" : error instanceof Error ? error.message : "离线快照预览暂时不可用，请稍后重试。" });
    }
  }

  return <section className={styles.panel} aria-label="锦衣卫离线新闻快照预览">
    <div className={styles.heading}><div><span className={styles.eyebrow}>NEWS SNAPSHOT PREVIEW</span><h3>新闻情报预览</h3></div><small>{currentPreview ? `规则 ${currentPreview.rulesVersion}` : "离线输入"}</small></div>
    <div className={styles.importRow}>
      <label className={styles.fileLabel} htmlFor="jinyiwei-news-snapshot">导入离线 JSON 快照</label>
      <input id="jinyiwei-news-snapshot" className={styles.fileInput} type="file" accept="application/json,.json" onChange={importSnapshot} disabled={importState.phase === "loading"} />
      <small>只提交到同源预览接口，不联网抓取。</small>
    </div>
    {importState.phase === "loading" ? <p className={styles.status}>正在核验快照…</p> : null}
    {importState.phase === "error" ? <p className={styles.error} role="alert">{importState.message}</p> : null}
    {!currentPreview ? <p className={styles.empty}>尚未载入已批准 Feed 快照；当前不联网、不抓取，也不把新闻标题写入史馆。</p> : <>
      <div className={styles.meta}><span>快照 {currentPreview.snapshotId}</span><span>条目 {currentPreview.articles.length} · 事件 {currentPreview.events.length} · 拒绝 {currentPreview.rejected.length}</span></div>
      <div className={styles.events}>{currentPreview.events.map((event) => <article className={styles.event} key={event.eventId}><div className={styles.eventHeader}><strong>{event.title}</strong><span className={event.state === "CONFLICTED" ? styles.conflict : styles.state}>{EVENT_LABELS[event.state]}</span></div><p>来源 {event.sourceIds.join("、")} · 文章 {event.articleIds.length} 篇 · {event.evidenceState}</p><small>不得推断：{event.doNotInfer ? "是" : "否"}</small></article>)}</div>
      {currentPreview.rejected.length > 0 ? <details className={styles.rejected}><summary>查看被拒条目</summary>{currentPreview.rejected.map((item) => <p key={`${item.ordinal}:${item.reason}`}>#{item.ordinal + 1} · {item.reason}</p>)}</details> : null}
      <p className={styles.note}>{currentPreview.doNotInfer}</p>
    </>}
  </section>;
}
