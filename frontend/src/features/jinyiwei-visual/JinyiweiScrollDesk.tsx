"use client";

import { useEffect, useState } from "react";
import type { JinyiweiDetail, JinyiweiTrustRead } from "../../lib/backendClient";

import { CollapsedEdictScroll, EdictStage } from "../court-visuals/edict/EdictStage";
import styles from "./JinyiweiScrollDesk.module.css";
import {
  buildFactDispatchRows,
  dispatchStatusLabel,
} from "./jinyiweiDispatch";
import { JinyiweiTrustPanel } from "./JinyiweiTrustPanel";

export { buildFactDispatchRows } from "./jinyiweiDispatch";
export type { FactDispatchInput, FactDispatchRow } from "./jinyiweiDispatch";

type Investigation = {
  investigationId: string;
  question: string;
  status: string;
  requestingAgent: string;
  evidenceCount: number;
  sourceAttemptCount: number;
  linkedReplyCount: number;
};

type InvestigationPage = { items: Investigation[] };
type Phase = "loading" | "ready" | "error";
type DetailState =
  | { phase: "idle" | "loading" }
  | { phase: "ready"; data: JinyiweiDetail }
  | { phase: "error" };
type TrustState =
  | { phase: "idle" | "loading" }
  | { phase: "ready"; data: JinyiweiTrustRead }
  | { phase: "error" };

function statusLabel(status: string) {
  return ({ RESOLVED: "已结案", PARTIAL: "部分结案", BLOCKED: "受阻", UNAVAILABLE: "不可用" } as Record<string, string>)[status] ?? status;
}

export function JinyiweiScrollDesk() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [items, setItems] = useState<Investigation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<DetailState>({ phase: "idle" });
  const [trust, setTrust] = useState<TrustState>({ phase: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/jinyiwei/investigations?limit=20&offset=0", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || typeof body !== "object" || body === null || !("page" in body)) throw new Error();
        const page = (body as { page: InvestigationPage }).page;
        if (!Array.isArray(page.items)) throw new Error();
        setItems(page.items);
        setSelectedId(page.items[0]?.investigationId ?? null);
        setPhase("ready");
      } catch {
        if (!controller.signal.aborted) setPhase("error");
      }
    })();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!expanded || selectedId === null) {
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setDetail({ phase: "loading" });
    });
    void (async () => {
      try {
        const response = await fetch(
          `/api/jinyiwei/investigations/${encodeURIComponent(selectedId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || typeof body !== "object" || body === null || !("investigation" in body)) {
          setDetail({ phase: "error" });
          return;
        }
        setDetail({ phase: "ready", data: (body as { investigation: JinyiweiDetail }).investigation });
      } catch {
        if (!controller.signal.aborted) setDetail({ phase: "error" });
      }
    })();
    return () => controller.abort();
  }, [expanded, selectedId]);

  useEffect(() => {
    if (!expanded || selectedId === null) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setTrust({ phase: "loading" });
    });
    void (async () => {
      try {
        const response = await fetch(`/api/jinyiwei/investigations/${encodeURIComponent(selectedId)}/trust`, { cache: "no-store", signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || typeof body !== "object" || body === null || !("trust" in body)) {
          setTrust({ phase: "error" });
          return;
        }
        setTrust({ phase: "ready", data: (body as { trust: JinyiweiTrustRead }).trust });
      } catch {
        if (!controller.signal.aborted) setTrust({ phase: "error" });
      }
    })();
    return () => controller.abort();
  }, [expanded, selectedId]);

  const selected = items.find((item) => item.investigationId === selectedId) ?? null;
  const documentTitle = detail.phase === "ready" ? detail.data.request.question : selected?.question ?? "未选定案卷";
  const select = (id: string) => {
    setSelectedId(id);
    setExpanded(true);
    setDetail({ phase: "idle" });
    setTrust({ phase: "idle" });
  };

  return (
    <main className={styles.desk} aria-label="锦衣卫只读案卷台">
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.content}>
        <header className={styles.intro}>
          <p>JINYIWEI · READ-ONLY EVIDENCE DESK</p>
          <h1>锦衣卫案牍台</h1>
          <span>仅陈列锦衣卫已处理案卷 · 循证阅卷</span>
        </header>

        <section className={styles.workspace}>
          <aside className={styles.index} aria-label="已处理案卷索引">
            <div className={styles.panelHeading}><span>已处理案卷</span><small>只读</small></div>
            {phase === "loading" ? <p className={styles.panelHint}>正在核对已处理案卷…</p> : null}
            {phase === "error" ? <div className={styles.errorBlock}><p className={styles.panelHint}>案卷目录暂时无法读取。</p><button className={styles.retryButton} type="button" onClick={() => { setPhase("loading"); setReloadKey((value) => value + 1); }}>重新读取案卷目录</button></div> : null}
            {phase === "ready" && items.length === 0 ? <p className={styles.panelHint}>暂无锦衣卫已处理案卷。</p> : null}
            <div className={styles.caseList}>
              {items.map((item) => <button className={item.investigationId === selectedId ? styles.caseActive : styles.caseButton} key={item.investigationId} onClick={() => select(item.investigationId)} type="button"><span>{statusLabel(item.status)}</span><strong>{item.question}</strong><small>证据 {item.evidenceCount} · 回奏 {item.linkedReplyCount}</small></button>)}
            </div>
          </aside>

        <section className={styles.scrollColumn} aria-label="案卷正文">
            {!selected ? <div className={styles.emptyScroll}>只展示已处理案卷；当前没有可展开的卷宗。</div> : !expanded ? <CollapsedEdictScroll className={styles.collapsed} countLabel={`证据 ${selected.evidenceCount}`} onOpen={() => setExpanded(true)} source={selected.requestingAgent} status={statusLabel(selected.status)} title={selected.question} /> : <div className={styles.expandedScroll}><EdictStage bodyLabel="锦衣卫只读案卷正文" document={{ id: selected.investigationId, kicker: "JINYIWEI · PROCESSED CASE", title: documentTitle, issuer: `请调司：${selected.requestingAgent}`, seal: { glyph: "卫", first: "锦", second: "衣" } }} theme="secret"><DetailContent detail={detail} trust={trust.phase === "ready" ? trust.data : null} trustPending={trust.phase === "loading"} /></EdictStage></div>}
          </section>

          <aside className={styles.evidence} aria-label="证据摘要">
            <div className={styles.panelHeading}><span>证据摘要</span><small>审计</small></div>
            {selected ? <><dl className={styles.facts}><div><dt>案卷状态</dt><dd>{statusLabel(selected.status)}</dd></div><div><dt>请调司</dt><dd>{selected.requestingAgent}</dd></div><div><dt>证据数量</dt><dd>{selected.evidenceCount}</dd></div></dl><div className={styles.boundary}><strong>采纳边界</strong><p>仅可浏览已采纳的不可变证据快照；这里没有采集、编辑或删除入口。</p></div></> : <p className={styles.panelHint}>选择已处理案卷后显示摘要。</p>}
          </aside>
        </section>
      </div>
    </main>
  );
}

function DetailContent({ detail, trust, trustPending }: { detail: DetailState; trust: JinyiweiTrustRead | null; trustPending: boolean }) {
  if (detail.phase === "ready") return <CaseDetail detail={detail.data} trust={trust} trustPending={trustPending} />;
  if (detail.phase === "error") return <p className={styles.scrollState} role="alert">案卷正文暂时无法读取。</p>;
  return <p className={styles.scrollState}>正在拆封案卷…</p>;
}

function CaseDetail({ detail, trust, trustPending }: { detail: JinyiweiDetail; trust: JinyiweiTrustRead | null; trustPending: boolean }) {
  const evidenceCount = Object.values(detail.evidenceByFact).flat().length;
  const dispatchRows = buildFactDispatchRows(detail);
  return <article className={styles.caseBody}>
    <p className={styles.lead}>{detail.request.decisionContext}</p>
    <section><h3>所需事实</h3><ul>{detail.request.requiredFacts.map((fact) => <li key={fact.key}><strong>{fact.key}</strong>：{fact.description}</li>)}</ul></section>
    <section aria-label="事实分发台"><h3>事实分发台</h3><p>事实 → 证据 → 回奏；只显示已核验案卷中的真实关联。</p><ol className={styles.dispatchSpine}>{dispatchRows.map((row) => <li key={row.factKey} className={styles.dispatchRow}><div><strong>{row.factKey}</strong><span>{row.description}</span></div><div className={styles.dispatchMeta}><b className={`${styles.dispatchStatus} ${styles[`dispatch${row.status}`]}`}>{dispatchStatusLabel(row.status)}</b><small>证据 {row.evidenceCount} · 回奏 {row.relatedReplyCount}</small></div></li>)}</ol></section>
    <section><h3>证据留痕</h3><p>已保留 {evidenceCount} 条证据，调查来源尝试 {detail.sourceAttempts.length} 次。</p></section>
    <section><h3>不得推断</h3>{detail.doNotInfer.length === 0 ? <p>未登记额外推断限制。</p> : <ul>{detail.doNotInfer.map((limit) => <li key={limit}>{limit}</li>)}</ul>}</section>
    {trustPending ? <p className={styles.trustNotice}>正在读取真实性评估与证据覆盖…</p> : null}
    <JinyiweiTrustPanel detail={detail} trust={trust} />
  </article>;
}
