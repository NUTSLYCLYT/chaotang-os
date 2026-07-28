"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  closeStudyDrawer,
  type ConsultMessage,
  type StudyDrawerSide,
} from "../../app/study/chancellorConsultStatus";
import {
  shouldSubmitConsultKey,
  submitConsultDraft,
} from "../../app/study/chancellorConsultSubmission";
import type { StudyRecentRepliesState } from "../../app/study/studyRecentReplies";
import { formatBusinessTime } from "../../lib/formatBusinessTime";
import styles from "./StudySideDrawers.module.css";

export interface StudySideDrawersProps {
  recentReplies: StudyRecentRepliesState;
  onOpenRecentReplies(): void;
  onRetryRecentReplies(): void;
  onSelectRecentReply(archiveId: string): void;
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

  function close(side: StudyDrawerSide, restoreFocus = true) {
    if (!restoreFocus) {
      setOpen(null);
      return;
    }
    closeStudyDrawer(
      side,
      setOpen,
      side === "left" ? leftTriggerRef.current : rightTriggerRef.current,
      (callback) => window.setTimeout(callback, 0),
    );
  }

  async function sendDraft() {
    if (props.pending || !draft.trim()) return;
    setDraft(await submitConsultDraft(draft, props.onSend));
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
      <button ref={leftTriggerRef} className={`${styles.trigger} ${styles.leftTrigger}`} type="button" aria-label="打开上书房左侧抽屉" onClick={() => {
        setOpen("left");
        props.onOpenRecentReplies();
      }}>‹</button>
      <button ref={rightTriggerRef} className={`${styles.trigger} ${styles.rightTrigger}`} type="button" aria-label="打开上书房右侧抽屉" onClick={() => setOpen("right")}>›</button>
      {open && <button className={styles.backdrop} type="button" aria-label="关闭抽屉" onClick={() => close(open)} />}
      {open === "left" && <aside className={`${styles.drawer} ${styles.leftOpen}`}>
        <header><h2>御前侧记</h2><button ref={closeRef} type="button" onClick={() => close("left")}>关闭</button></header>
        <section className={styles.records}>
          <h3>最近三次下旨回奏</h3>
          {props.recentReplies.phase === "loading" && (
            <p className={styles.recordState}>正在读取最近回奏……</p>
          )}
          {props.recentReplies.phase === "empty" && (
            <p className={styles.recordState}>尚无已归档回奏。</p>
          )}
          {props.recentReplies.phase === "error" && (
            <div className={styles.recordState} role="alert">
              <p>{props.recentReplies.message}</p>
              <button className={styles.retryButton} type="button" onClick={props.onRetryRecentReplies}>重试</button>
            </div>
          )}
          {props.recentReplies.archives.slice(0, 3).map((archive) => (
            <article className={styles.decreeSlip} key={archive.id}>
              <span className={styles.bindingLine} aria-hidden="true" />
              <button
                type="button"
                className={styles.decreeSlipButton}
                aria-label={`展卷阅奏：${archive.sourceText}`}
                onClick={() => {
                  props.onSelectRecentReply(archive.id);
                  close("left", false);
                }}
              >
                <span className={styles.recordMeta}>
                  <time dateTime={archive.replyTime ?? undefined}>{formatBusinessTime(archive.replyTime)}</time> · {archive.participatingDepartments!.join("、")}
                </span>
                <strong className={styles.recordSummary}>{archive.sourceText}</strong>
                <span className={styles.openReply}>展卷阅奏</span>
                <span className={styles.replySeal} aria-hidden="true">回奏</span>
              </button>
            </article>
          ))}
        </section>
        <section className={styles.chat}>
          <h3>与丞相对话</h3>
          <div className={styles.messages} aria-live="polite">
            {props.messages.length === 0 && <p className={styles.emptyMessage}>尚无对话。</p>}
            {props.messages.map((message, index) => (
              <div className={styles.messageRow} key={`${index}-${message.role}`} data-role={message.role}>
                <Image
                  className={styles.avatar}
                  src={message.role === "user"
                    ? "/shangshufang/portrait-wang.webp"
                    : "/shangshufang/portrait-chancellor.webp"}
                  alt={message.role === "user" ? "陛下" : "丞相"}
                  width={36}
                  height={36}
                />
                <div className={styles.messageContent}>
                  <span className={styles.messageAuthor}>{message.role === "user" ? "陛下" : "丞相"}</span>
                  <p className={styles.messageBubble}>{message.content}</p>
                </div>
              </div>
            ))}
            {props.pending && (
              <div className={styles.messageRow} data-role="assistant">
                <Image
                  className={styles.avatar}
                  src="/shangshufang/portrait-chancellor.webp"
                  alt="丞相"
                  width={36}
                  height={36}
                />
                <div className={styles.messageContent}>
                  <span className={styles.messageAuthor}>丞相</span>
                  <p className={styles.messageBubble}>正在思量……</p>
                </div>
              </div>
            )}
            {props.error && <p className={styles.error}>{props.error}</p>}
          </div>
          <form onSubmit={async (event) => {
            event.preventDefault();
            await sendDraft();
          }}>
            <textarea
              aria-label="给丞相的咨询内容"
              maxLength={4000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={async (event) => {
                if (!shouldSubmitConsultKey({
                  key: event.key,
                  shiftKey: event.shiftKey,
                  isComposing: event.nativeEvent.isComposing,
                })) return;
                event.preventDefault();
                await sendDraft();
              }}
            />
            <button
              className={styles.sendButton}
              type="submit"
              aria-label="发送"
              disabled={props.pending || !draft.trim()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.7 3.4 21 11.2a.9.9 0 0 1 0 1.6L3.7 20.6a.9.9 0 0 1-1.2-1l1.2-6.1 9.1-1.5-9.1-1.5-1.2-6.1a.9.9 0 0 1 1.2-1Z" />
              </svg>
            </button>
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
