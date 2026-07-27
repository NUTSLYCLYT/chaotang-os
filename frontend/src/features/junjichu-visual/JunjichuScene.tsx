"use client";

import { CourtCapabilityButton } from "../court-visuals/CourtCapabilityButton";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import {
  CollapsedEdictScroll,
  EdictStage,
} from "../court-visuals/edict/EdictStage";
import type { ReplyCaseView } from "../court-replies/replyFeed";
import { projectJunjichuFacts } from "./junjichuProjection";
import styles from "./JunjichuScene.module.css";

const VERDICT_ACTIONS = [
  { id: "adopt", label: "采纳", explanation: "当前页面只读取已经归档的真实回奏，不能采纳或批准执行。" },
  { id: "request_evidence", label: "补证", explanation: "补充证据必须在受控办理流程中发起，军机处只读页不能修改归档证据。" },
  { id: "recheck", label: "复核", explanation: "本页不写入复盘或复核状态；需要复盘时请前往史馆使用现有受控流程。" },
  { id: "reject", label: "驳回", explanation: "归档回奏不能在军机处只读页被驳回或改写。" },
  { id: "followup", label: "追问", explanation: "本页不触发模型或追加问询；新的办理请求必须从上书房下旨。" },
] as const;

const DISPATCH_ACTIONS = [
  { id: "summon", label: "发起会审", explanation: "当前真实流程由上书房下旨触发，军机处只读页不能发起会审。" },
  { id: "approve", label: "批准执行", explanation: "REPLY 归档不是实时执行任务，本页不能批准或启动执行。" },
  { id: "dispatch", label: "追加派发", explanation: "本页没有派发写能力；追加事项必须由上书房重新下旨。" },
] as const;
const SIX_MINISTRIES = ["吏部", "户部", "礼部", "兵部", "刑部", "工部"] as const;

export interface JunjichuSceneProps {
  cases: ReplyCaseView[] | null;
  department: string;
  departments: string[];
  selectedId: string | null;
  error: string | null;
  onDepartmentChange(department: string): void;
  onSelect(id: string): void;
  onRetry(): void;
}

export function JunjichuScene({
  cases,
  department,
  departments,
  selectedId,
  error,
  onDepartmentChange,
  onSelect,
  onRetry,
}: JunjichuSceneProps) {
  const selected = cases?.find((item) => item.id === selectedId) ?? cases?.[0] ?? null;
  const facts = selected ? projectJunjichuFacts(selected) : [];

  return (
    <ImmersiveCourtShell
      currentLabel="军机处"
      currentPath="/junjichu"
      backgroundImage="/assets/junjichu/war-room-full.webp"
      scene="junjichu"
    >
      <div className={styles.scene}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>GRAND COUNCIL · ARCHIVED REPLIES</p>
          <h1>军机处</h1>
          <p>真实回奏案卷 · 只读会审台</p>
        </header>

        {error ? (
          <section className={`${styles.stateCard} ${styles.errorCard}`} data-junjichu-state="error" role="alert">
            <span className={styles.stateSeal} aria-hidden="true">!</span>
            <div><h2>回奏案卷暂不可读</h2><p>{error}</p></div>
            <button className={styles.retryButton} type="button" onClick={onRetry}>重试读取</button>
          </section>
        ) : cases === null ? (
          <section className={styles.stateCard} data-junjichu-state="loading" aria-live="polite">
            <span className={styles.loadingSeal} aria-hidden="true" />
            <div><h2>正在核对史馆回奏</h2><p>仅从当前用户可见的 REPLY 归档读取事实。</p></div>
          </section>
        ) : cases.length === 0 ? (
          <section className={styles.stateCard} data-junjichu-state="empty" aria-live="polite">
            <span className={styles.stateSeal} aria-hidden="true">◇</span>
            <div>
              <h2>{department ? "当前部门暂无完整回奏" : "暂无完整真实回奏"}</h2>
              <p>{department
                ? `史馆中没有可完整展示且包含“${department}”的 REPLY 归档。`
                : "史馆尚未返回字段完整、可供军机处只读展示的 REPLY 归档。"}</p>
            </div>
          </section>
        ) : selected ? (
          <section className={styles.workspace} data-junjichu-state="ready">
            <section className={styles.caseDeck} aria-labelledby="reply-list-heading">
              <div className={styles.deckHeading}>
                <div><p>军机处为何开</p><h2 id="reply-list-heading">当前案卷</h2></div>
                <span>真实 REPLY · 只读</span>
              </div>
              <label className={styles.filter}>
                <span>参与部门</span>
                <select value={department} onChange={(event) => onDepartmentChange(event.target.value)}>
                  <option value="">全部回奏</option>
                  {departments.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className={styles.caseList}>
                {cases.map((item) => (
                  <CollapsedEdictScroll
                    key={item.id}
                    title={item.title}
                    status={selected.id === item.id ? "当前案卷" : "已归档"}
                    source={item.departments.join("、")}
                    countLabel={item.repliedAt}
                    onOpen={() => onSelect(item.id)}
                    className={selected.id === item.id ? styles.selectedCase : ""}
                  />
                ))}
              </div>
            </section>

            <section className={styles.imperialStage}>
              <EdictStage
                theme="secret"
                document={{
                  id: selected.id,
                  kicker: "JUNJICHU COMMAND",
                  title: selected.title,
                  issuer: "军机处 · 史馆回奏主卷",
                }}
                bodyLabel="军机处真实回奏"
                footer={<div className={styles.edictFooter}><span>回奏时间</span><time dateTime={selected.repliedAt}>{selected.repliedAt}</time></div>}
              >
                <dl className={styles.caseMeta}>
                  <div><dt>圣旨来源</dt><dd>史馆真实 REPLY 归档</dd></div>
                  <div><dt>回奏人</dt><dd>{selected.respondent}</dd></div>
                </dl>
                <section className={styles.scrollSection}>
                  <h3>军机处 · 办理路径</h3>
                  <p className={styles.process}>{selected.process}</p>
                </section>
                <section className={styles.scrollSection}>
                  <h3>御前回奏</h3>
                  <p className={styles.conclusion}>{selected.conclusion}</p>
                </section>
              </EdictStage>
            </section>

            <section className={styles.intelligenceDeck} aria-labelledby="facts-heading">
              <div className={styles.deckHeading}>
                <div><p>军机处审出了什么</p><h2 id="facts-heading">会审与风险回写</h2></div>
                <span>归档事实</span>
              </div>
              <div className={styles.factGrid}>
                {facts.map((fact) => (
                  <div className={styles.factCard} key={fact.label}>
                    <span>{fact.label}</span>
                    <strong aria-label={fact.value === null ? "归档未提供" : undefined}>
                      {fact.value ?? "—"}
                    </strong>
                  </div>
                ))}
              </div>
              <section className={styles.riskSegment}>
                <h3>冲突与风险</h3>
                <p>当前完整 REPLY 归档未提供独立风险或蜂群字段，不以旧 dev 演示数据补造。</p>
              </section>
              <div className={styles.readonlyNotice}>
                <strong>只读视图</strong>
                <p>本页不显示归档中没有的逐司意见、实时阶段、执行状态、优先级或任务状态。</p>
              </div>
            </section>

            <footer className={styles.verdictDeck}>
              <section className={styles.actionBar} aria-label="五键裁决（只读）">
                <div><strong>五键裁决</strong><span>当前为史馆归档回奏，只展示旧动作位置</span></div>
                {VERDICT_ACTIONS.map((action) => (
                  <CourtCapabilityButton key={action.id} capability="unavailable" explanation={action.explanation}>
                    {action.label}
                  </CourtCapabilityButton>
                ))}
              </section>
              <section className={styles.actionBar} aria-label="调度能力（只读）">
                <div><strong>流转调度</strong><span>真实业务入口仍在上书房</span></div>
                {DISPATCH_ACTIONS.map((action) => (
                  <CourtCapabilityButton key={action.id} capability="unavailable" explanation={action.explanation}>
                    {action.label}
                  </CourtCapabilityButton>
                ))}
              </section>
            </footer>

            <section className={styles.councilDeck} aria-labelledby="council-heading">
              <div className={styles.deckHeading}>
                <div><p>六部会审</p><h2 id="council-heading">六部表态</h2></div>
                <span>参与状态 · 归档事实</span>
              </div>
              <div className={styles.ministryGrid}>
                {SIX_MINISTRIES.map((ministry) => {
                  const participated = selected.departments.includes(ministry);
                  return (
                    <article key={ministry} data-participated={participated}>
                      <div><strong>{ministry}</strong><span>{participated ? "已参与" : "未列名"}</span></div>
                      <p>{participated
                        ? "该部列入本案参与衙门；归档未提供逐部表态原文。"
                        : "该部未列入本次回奏的参与衙门。"}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
        ) : null}
      </div>
    </ImmersiveCourtShell>
  );
}
