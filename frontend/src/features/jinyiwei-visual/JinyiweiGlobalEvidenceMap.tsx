"use client";

import type { JinyiweiCoverageRead, JinyiweiFeedSource, JinyiweiFeedsRead, JinyiweiTrustState } from "../../lib/backendClient";
import styles from "./JinyiweiGlobalEvidenceMap.module.css";

const STATE_LABELS: Record<JinyiweiTrustState, string> = {
  VERIFIED: "已验证", PROBABLE: "较可信", MIXED: "来源混合", CONFLICTED: "存在冲突", STALE: "证据过期", UNAVAILABLE: "不可用",
};

function feedSummary(feeds: JinyiweiFeedsRead): string {
  return feeds.sources.length === 0 ? "未启用外部 Feed" : `已批准 ${feeds.sources.length} 个来源`;
}

export function JinyiweiGlobalEvidenceMap({ coverage, feeds }: { coverage: JinyiweiCoverageRead | null; feeds: JinyiweiFeedsRead | null }) {
  const points = coverage?.points ?? [];
  return <section className={styles.panel} aria-label="全球证据覆盖地图与受控来源">
    <div className={styles.heading}><div><span className={styles.eyebrow}>GLOBAL EVIDENCE MAP</span><h3>全球证据覆盖</h3></div><small>{coverage ? `生成于 ${new Date(coverage.generatedAt).toLocaleString("zh-CN")}` : "正在读取"}</small></div>
    {!coverage ? <p className={styles.empty}>覆盖投影尚未返回；案卷正文仍可继续阅读。</p> : <>
      <div className={styles.mapSurface} role="img" aria-label="按已验证证据 coverage 展示的区域级全球地图"><div className={styles.mapGrid} aria-hidden="true" />{points.length === 0 ? <p className={styles.empty}>当前没有带区域 coverage 的证据。</p> : <div className={styles.pointList}>{points.map((point) => <details className={styles.point} key={point.region}><summary><strong>{point.region}</strong><span>{STATE_LABELS[point.trustState]} · 证据 {point.evidenceCount}</span></summary><small>调查 {point.investigationIds.join("、")}</small><small>冲突 {point.conflictCount} · {Math.round(point.confidenceLower * 100)}–{Math.round(point.confidenceUpper * 100)}%</small>{point.references.map((reference) => <small key={`${reference.investigationId}:${reference.factKey}`}>事实 {reference.factKey} · {reference.evidence.map((item) => item.evidenceId).join("、")}</small>)}</details>)}</div>}</div>
      <p className={styles.scanMeta}>已扫描调查 {coverage.scannedInvestigations} / {coverage.totalInvestigations}{coverage.truncated ? " · 仅显示前 100 份，结果已截断" : ""}</p>
      <p className={styles.note}>地图仅使用调查证据声明的区域名称；不推断经纬度、个人位置或未入链热点。</p>
    </>}
    <div className={styles.feedStrip}><span><strong>受控新闻源</strong>：{feeds ? feedSummary(feeds) : "正在读取"}</span>{feeds?.sources.length ? <span>{feeds.sources.map((source: JinyiweiFeedSource) => source.publisher).join("、")}</span> : <span>默认拒绝未知来源与外网抓取</span>}</div>
  </section>;
}
