"use client";

import { useEffect, useRef, useState } from "react";

import {
  closeStudyDrawer,
  type ConsultMessage,
  type StudyDrawerSide,
} from "../../app/study/chancellorConsultStatus";
import { submitConsultDraft } from "../../app/study/chancellorConsultSubmission";
import type { DecreeSessionRecord } from "../../app/study/decreeSessionLog";
import styles from "./StudySideDrawers.module.css";

export interface StudySideDrawersProps {
  records: DecreeSessionRecord[];
  messages: ConsultMessage[];
  pending: boolean;
  error: string | null;
  onSend(content: string): Promise<boolean>;
}

export function StudySideDrawers(props: StudySideDrawersProps) {
  const [open, setOpen] = useState<"left" | "right" | null>(null);
  const [draft, setDraft] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const leftTriggerRef = useRef<HTMLButtonElement>(null);
  const rightTriggerRef = useRef<HTMLButtonElement>(null);

  function close(side: StudyDrawerSide) {
    closeStudyDrawer(
      side,
      setOpen,
      side === "left" ? leftTriggerRef.current : rightTriggerRef.current,
      (callback) => window.setTimeout(callback, 0),
    );
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) close(open);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  return (
    <>
      <button ref={leftTriggerRef} className={`${styles.trigger} ${styles.leftTrigger}`} type="button" aria-label="打开上书房左侧抽屉" onClick={() => setOpen("left")}>‹</button>
      <button ref={rightTriggerRef} className={`${styles.trigger} ${styles.rightTrigger}`} type="button" aria-label="打开上书房右侧抽屉" onClick={() => setOpen("right")}>›</button>
      {open && <button className={styles.backdrop} type="button" aria-label="关闭抽屉" onClick={() => close(open)} />}
      {open === "left" && <aside className={`${styles.drawer} ${styles.leftOpen}`}>
        <header><h2>御前侧记</h2><button ref={closeRef} type="button" onClick={() => close("left")}>关闭</button></header>
        <section className={styles.records}>
          <h3>本次页面会话内的下旨记录</h3>
          {props.records.length === 0 ? <p>尚无记录。请先在御前输入旨意并点击“下旨”。</p> :
            props.records.map((record) => <article key={record.id}><strong>{record.decree}</strong><p>{record.summary}</p></article>)}
        </section>
        <section className={styles.chat}>
          <h3>与丞相对话</h3>
          <p className={styles.notice}>仅提供咨询，不代表下旨、审批、执行或归档。需要办理请使用御前“下旨”。发送将产生一次真实 DeepSeek 模型调用；对话只保留在当前页面会话。</p>
          <div className={styles.messages} aria-live="polite">
            {props.messages.length === 0 && <p>尚无对话。</p>}
            {props.messages.map((message, index) => <p key={`${index}-${message.role}`} data-role={message.role}><strong>{message.role === "user" ? "陛下" : "丞相"}：</strong>{message.content}</p>)}
            {props.pending && <p>丞相正在思量……</p>}
            {props.error && <p className={styles.error}>{props.error}</p>}
          </div>
          <form onSubmit={async (event) => {
            event.preventDefault();
            if (props.pending) return;
            setDraft(await submitConsultDraft(draft, props.onSend));
          }}>
            <textarea aria-label="给丞相的咨询内容" maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} />
            <button type="submit" disabled={props.pending || !draft.trim()}>发送</button>
          </form>
        </section>
      </aside>}
      {open === "right" && <aside className={`${styles.drawer} ${styles.rightOpen}`}>
        <header><h2>右侧抽屉</h2><button ref={closeRef} type="button" onClick={() => close("right")}>关闭</button></header>
        <div className={styles.unavailable}>暂未开放</div>
      </aside>}
    </>
  );
}
