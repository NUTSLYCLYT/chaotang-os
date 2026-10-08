"use client";

import type { JinyiweiNewsPreview } from "../../lib/backendClient";
import styles from "./JinyiweiNewsDesk.module.css";

const EVENT_LABELS = { SINGLE_SOURCE: "单一来源", MULTI_SOURCE: "多来源", CONFLICTED: "内容冲突" } as const;

export function JinyiweiNewsDesk({ preview }: { preview: JinyiweiNewsPreview | null }) {
  return <section className={styles.panel} aria-label="锦衣卫离线新闻快照预览">
    <div className={styles.heading}><div><span className={styles.eyebrow}>NEWS SNAPSHOT PREVIEW</span><h3>新闻情报预览</h3></div><small>{preview ? `规则 ${preview.rulesVersion}` : "离线输入"}</small></div>
    {!preview ? <p className={styles.empty}>尚未载入已批准 Feed 快照；当前不联网、不抓取，也不把新闻标题写入史馆。</p> : <>
      <div className={styles.meta}><span>快照 {preview.snapshotId}</span><span>条目 {preview.articles.length} · 事件 {preview.events.length} · 拒绝 {preview.rejected.length}</span></div>
      <div className={styles.events}>{preview.events.map((event) => <article className={styles.event} key={event.eventId}><div className={styles.eventHeader}><strong>{event.title}</strong><span className={event.state === "CONFLICTED" ? styles.conflict : styles.state}>{EVENT_LABELS[event.state]}</span></div><p>来源 {event.sourceIds.join("、")} · 文章 {event.articleIds.length} 篇 · {event.evidenceState}</p><small>不得推断：{event.doNotInfer ? "是" : "否"}</small></article>)}</div>
      {preview.rejected.length > 0 ? <details className={styles.rejected}><summary>查看被拒条目</summary>{preview.rejected.map((item) => <p key={`${item.ordinal}:${item.reason}`}>#{item.ordinal + 1} · {item.reason}</p>)}</details> : null}
      <p className={styles.note}>{preview.doNotInfer}</p>
    </>}
  </section>;
}
