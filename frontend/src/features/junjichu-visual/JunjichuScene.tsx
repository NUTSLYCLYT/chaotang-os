"use client";

import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import { EdictStage } from "../court-visuals/edict/EdictStage";
import {
  type JunjichuCaseStatus,
  type JunjichuCaseView,
} from "./junjichuController";
import { formatBusinessTime } from "../../lib/formatBusinessTime";
import styles from "./JunjichuScene.module.css";

const SIX_MINISTRIES = ["吏部", "户部", "礼部", "兵部", "刑部", "工部"] as const;
const STATUS_LABELS: Record<JunjichuCaseStatus, string> = {
  MINISTRY_REVIEWING: "六部核议中",
  COUNCIL_REVIEWING: "军机处会审中",
  CHANCELLOR_FINALIZING: "丞相汇总中",
  ARCHIVED: "已归档",
  FAILED: "本次办理未完成",
};

export interface JunjichuSceneProps {
  activeCases: JunjichuCaseView[] | null;
  archivedCases: JunjichuCaseView[] | null;
  failedCases: JunjichuCaseView[] | null;
  department: string;
  departments: string[];
  caseStatus: JunjichuCaseStatus | "";
  keyword: string;
  selectedId: string | null;
  error: string | null;
  onDepartmentChange(department: string): void;
  onStatusChange(status: JunjichuCaseStatus | ""): void;
  onKeywordChange(keyword: string): void;
  onSelect(id: string): void;
  onRetry(): void;
}

function currentStage(selected: JunjichuCaseView): string {
  return selected.processingPath.at(-1) ?? STATUS_LABELS[selected.status];
}

function ministryState(selected: JunjichuCaseView, ministry: string): "未参与" | "办理中" | "已完成" {
  if (!selected.departments.includes(ministry)) return "未参与";
  return selected.completedMinistryOpinions.some((item) => item.department === ministry) ? "已完成" : "办理中";
}

function CaseCard({ item, selected, onSelect }: { item: JunjichuCaseView; selected: boolean; onSelect(id: string): void }) {
  return (
    <button type="button" className={`${styles.caseCard} ${selected ? styles.selectedCase : ""}`} onClick={() => onSelect(item.id)}>
      <span>{STATUS_LABELS[item.status]}</span>
      <strong>{item.decreeText}</strong>
      <small>{item.departments.join(" · ") || "待核对参与部院"}</small>
      <time dateTime={item.updatedAt}>更新 {formatBusinessTime(item.updatedAt)}</time>
    </button>
  );
}

type CaseLedgerProps = Omit<
  JunjichuSceneProps,
  "activeCases" | "archivedCases" | "failedCases" | "error" | "onRetry"
> & {
  activeCases: JunjichuCaseView[];
  archivedCases: JunjichuCaseView[];
  failedCases: JunjichuCaseView[];
};

function CaseLedger({
  activeCases,
  archivedCases,
  failedCases,
  department,
  departments,
  caseStatus,
  keyword,
  selectedId,
  onDepartmentChange,
  onStatusChange,
  onKeywordChange,
  onSelect,
}: CaseLedgerProps) {
  return (
    <aside className={styles.caseDeck} aria-label="军机处案卷台账">
      <div className={styles.deckHeading}><div><p>会审案卷</p><h2>案卷台账</h2></div><span>只读</span></div>
      <label className={styles.filter}><span>状态</span><select value={caseStatus} onChange={(event) => onStatusChange(event.target.value as JunjichuCaseStatus | "")}><option value="">全部</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className={styles.filter}><span>参与部院</span><select value={department} onChange={(event) => onDepartmentChange(event.target.value)}><option value="">全部</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className={styles.filter}><span>关键词</span><input value={keyword} onChange={(event) => onKeywordChange(event.target.value)} placeholder="旨意或部院" /></label>
      <div className={styles.caseList}>
        <h3>进行中</h3>
        {activeCases.length ? activeCases.map((item) => <CaseCard key={item.id} item={item} selected={selectedId === item.id} onSelect={onSelect} />) : <p className={styles.emptyList}>没有进行中案卷</p>}
        <h3>已归档</h3>
        {archivedCases.length ? archivedCases.map((item) => <CaseCard key={item.id} item={item} selected={selectedId === item.id} onSelect={onSelect} />) : <p className={styles.emptyList}>没有已归档案卷</p>}
        <h3>办理失败</h3>
        {failedCases.length ? failedCases.map((item) => <CaseCard key={item.id} item={item} selected={selectedId === item.id} onSelect={onSelect} />) : <p className={styles.emptyList}>没有办理失败案卷</p>}
      </div>
    </aside>
  );
}

export function JunjichuScene({
  activeCases,
  archivedCases,
  failedCases,
  department,
  departments,
  caseStatus,
  keyword,
  selectedId,
  error,
  onDepartmentChange,
  onStatusChange,
  onKeywordChange,
  onSelect,
  onRetry,
}: JunjichuSceneProps) {
  const cases = [...(activeCases ?? []), ...(archivedCases ?? []), ...(failedCases ?? [])];
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0] ?? null;

  return (
    <ImmersiveCourtShell currentLabel="军机处" currentPath="/junjichu" backgroundImage="/assets/junjichu/junjichu.webp" scene="junjichu" hideScrollbar>
      <div className={styles.scene}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>GRAND COUNCIL · CASE LEDGER</p>
          <h1>军机处</h1>
          <a className={styles.sceneBoardLink} href="/junjichu/scene-board">
            查看 Scene Pack 任务看板
          </a>
        </header>

        {error ? (
          <section className={`${styles.stateCard} ${styles.errorCard}`} data-junjichu-state="error" role="alert">
            <span className={styles.stateSeal} aria-hidden="true">!</span>
            <div><h2>案卷暂不可读</h2><p>{error}</p></div>
            <button className={styles.retryButton} type="button" onClick={onRetry}>重新读取</button>
          </section>
        ) : activeCases === null || archivedCases === null || failedCases === null ? (
          <section className={styles.stateCard} data-junjichu-state="loading" aria-live="polite">
            <span className={styles.loadingSeal} aria-hidden="true" />
            <div><h2>正在核对军机处案卷</h2><p>正在读取本次会审已形成的真实检查点。</p></div>
          </section>
        ) : cases.length === 0 ? (
          <section className={styles.workspace}>
            <CaseLedger {...{ activeCases, archivedCases, failedCases, department, departments, caseStatus, keyword, selectedId, onDepartmentChange, onStatusChange, onKeywordChange, onSelect }} />
            <main className={styles.imperialStage} data-junjichu-state="empty" aria-label="会审主舞台">
              <EdictStage className={styles.edictScroll} bodyLabel="军机处空案卷舞台" document={{ id: "junjichu-empty", kicker: "GRAND COUNCIL · CASE LEDGER", title: "暂无会审案卷", issuer: "军机处 · 等待下旨" }}>
              <section className={styles.emptyStage}>
                <p className={styles.stageKicker}>军机处会审</p>
                <p>等待下旨后进入会审</p>
              </section>
              </EdictStage>
            </main>
            <aside className={styles.intelligenceDeck} aria-label="六部投影">
              <div className={styles.deckHeading}><div><p>固定目录</p><h2>六部投影</h2></div><span>尚无案卷</span></div>
              <div className={styles.ministryGrid}>{SIX_MINISTRIES.map((ministry) => <article key={ministry} data-state="未参与"><strong>{ministry}</strong><span>未参与</span><p>暂无会审案卷</p></article>)}</div>
              <p className={styles.readonlyNotice}>尚无案卷经过军机处；这里不预填部门意见、结论或回奏。</p>
            </aside>
          </section>
        ) : selected ? (
          <section className={styles.workspace} data-junjichu-state="ready">
            <CaseLedger {...{ activeCases, archivedCases, failedCases, department, departments, caseStatus, keyword, selectedId, onDepartmentChange, onStatusChange, onKeywordChange, onSelect }} />

            <main className={styles.imperialStage} aria-label="会审主舞台">
              <EdictStage className={styles.edictScroll} bodyLabel="军机处会审案卷正文" document={{ id: selected.id, kicker: STATUS_LABELS[selected.status], title: selected.decreeText, issuer: "军机处会审" }}>
                <p className={styles.stageKicker}>{STATUS_LABELS[selected.status]}</p>
                <dl className={styles.caseMeta}><div><dt>当前节点</dt><dd>{currentStage(selected)}</dd></div><div><dt>最近更新</dt><dd><time dateTime={selected.updatedAt}>{formatBusinessTime(selected.updatedAt)}</time></dd></div></dl>
                <section className={styles.pathSection}><h3>真实办理路径</h3><ol className={styles.path}>{selected.processingPath.map((step, index) => <li key={`${step}-${index}`} data-current={index === selected.processingPath.length - 1}>{step}</li>)}</ol></section>
                {selected.completedMinistryOpinions.length > 0 ? <section className={styles.opinionSection}><h3>已完成部议</h3>{selected.completedMinistryOpinions.map((item) => <article key={item.department}><strong>{item.department}</strong><p>{item.opinion}</p>{item.bureauOpinions.length > 0 ? <ul>{item.bureauOpinions.map((bureau) => <li key={bureau.bureau}>{bureau.bureau}：{bureau.opinion}</li>)}</ul> : null}</article>)}</section> : <p className={styles.waiting}>尚未形成可展示的部议；本页不会预填或推演后续意见。</p>}
                {selected.status === "ARCHIVED" ? <section className={styles.archiveSummary}><h3>已归档会审结论</h3><p>{selected.councilVerdict ?? "归档案卷未提供单列会审结论。"}</p>{selected.replyId ? <a href={`/shiguan?archive=${encodeURIComponent(selected.replyId)}`}>查看史馆回奏摘要</a> : <p>该归档案卷尚无可链接的史馆回奏。</p>}</section> : null}
              </EdictStage>
            </main>

            <aside className={styles.intelligenceDeck} aria-label="六部投影">
              <div className={styles.deckHeading}><div><p>固定目录</p><h2>六部投影</h2></div><span>当前案卷</span></div>
              <div className={styles.ministryGrid}>{SIX_MINISTRIES.map((ministry) => { const state = ministryState(selected, ministry); return <article key={ministry} data-state={state}><strong>{ministry}</strong><span>{state}</span><p>{state === "已完成" ? "已形成部议" : state === "办理中" ? "等待该部真实检查点" : "未列入本案"}</p></article>; })}</div>
              <p className={styles.readonlyNotice}>这里只投影真实参与和已完成检查点；不显示任何尚未形成的意见或结论。</p>
            </aside>
          </section>
        ) : null}
      </div>
    </ImmersiveCourtShell>
  );
}
