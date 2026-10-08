"use client";

import type { JinyiweiDetail, JinyiweiTrustAssessment, JinyiweiTrustRead, JinyiweiTrustState } from "../../lib/backendClient";
import styles from "./JinyiweiTrustPanel.module.css";

const STATE_LABELS: Record<JinyiweiTrustState, string> = {
  VERIFIED: "已验证",
  PROBABLE: "较可信",
  MIXED: "来源混合",
  CONFLICTED: "存在冲突",
  STALE: "证据过期",
  UNAVAILABLE: "不可用",
};

const QUALITY_LABELS = { PRIMARY: "一手", AUTHORITATIVE: "权威", SECONDARY: "二手", UNVERIFIED: "未验证" } as const;

export function trustStateLabel(state: JinyiweiTrustState): string {
  return STATE_LABELS[state];
}

export function buildCoverageRegions(detail: JinyiweiDetail): Array<{ name: string; evidenceCount: number }> {
  const counts = new Map<string, number>();
  for (const evidence of Object.values(detail.evidenceByFact).flat()) {
    for (const region of evidence.coverage ?? []) counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, evidenceCount]) => ({ name, evidenceCount }));
}

function percent(value: number): string { return `${Math.round(value * 100)}%`; }

function AssessmentCard({ factKey, assessment }: { factKey: string; assessment: JinyiweiTrustAssessment }) {
  return <article className={styles.card}>
    <div className={styles.cardHeader}><span className={`${styles.state} ${styles[`state${assessment.evidenceState}`]}`}>{trustStateLabel(assessment.evidenceState)}</span><code>{factKey}</code></div>
    <div className={styles.confidence}><strong>{percent(assessment.confidenceLower)}–{percent(assessment.confidenceUpper)}</strong><span>可信度区间</span></div>
    <dl className={styles.meta}><div><dt>来源级别</dt><dd>{QUALITY_LABELS[assessment.sourceLevel]}</dd></div><div><dt>决策准入</dt><dd>{assessment.decisionAllowed ? "允许" : "禁止"}</dd></div><div><dt>史馆准入</dt><dd>{assessment.archiveAllowed ? "允许" : "禁止"}</dd></div></dl>
    <p className={styles.conclusion}>{assessment.conclusion}</p>
    <details className={styles.drawer}><summary>查看评估依据</summary><p>{assessment.assessmentBasis}</p>{assessment.supportingEvidenceIds.length > 0 ? <p><b>支持证据：</b>{assessment.supportingEvidenceIds.join("、")}</p> : null}{assessment.counterEvidenceIds.length > 0 ? <p className={styles.warning}><b>反向证据：</b>{assessment.counterEvidenceIds.join("、")}</p> : null}{assessment.unresolvedQuestions.length > 0 ? <p><b>未解决：</b>{assessment.unresolvedQuestions.join("、")}</p> : null}{assessment.doNotInfer ? <p className={styles.warning}>当前结果不得推断为事实。</p> : null}</details>
  </article>;
}

export function JinyiweiTrustPanel({ detail, trust }: { detail: JinyiweiDetail; trust: JinyiweiTrustRead | null }) {
  const regions = buildCoverageRegions(detail);
  return <section className={styles.panel} aria-label="真实性评估与证据地图">
    <div className={styles.heading}><div><span className={styles.eyebrow}>EVIDENCE INTEGRITY</span><h3>真实性评估</h3></div><small>{trust ? `生成于 ${new Date(trust.generatedAt).toLocaleString("zh-CN")}` : "正在读取"}</small></div>
    {!trust ? <p className={styles.empty}>评估尚未返回；案卷正文仍可继续阅读。</p> : <>
      <div className={styles.cards}>{Object.entries(trust.assessments).map(([factKey, assessment]) => <AssessmentCard key={factKey} factKey={factKey} assessment={assessment} />)}</div>
      <div className={styles.mapBlock}><div className={styles.mapHeading}><div><span className={styles.eyebrow}>EVIDENCE COVERAGE</span><h4>全球证据地图投影</h4></div><small>区域级 · 只读</small></div><div className={styles.mapSurface} role="img" aria-label="按证据 coverage 展示的区域级地图投影"><div className={styles.mapGrid} aria-hidden="true" />{regions.length === 0 ? <span className={styles.mapEmpty}>当前证据没有声明地理 coverage。</span> : <div className={styles.regionList}>{regions.map((region) => <span className={styles.region} key={region.name}>{region.name}<b>{region.evidenceCount}</b></span>)}</div>}</div><p className={styles.mapNote}>地图只使用证据自身声明的 coverage；未提供坐标时不会猜测精确位置。</p></div>
    </>}
  </section>;
}
