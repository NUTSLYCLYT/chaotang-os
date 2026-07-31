"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  type ConsultMessage,
  type StudyDrawerSide,
} from "../../app/study/chancellorConsultStatus";
import {
  shouldSubmitConsultKey,
  submitConsultDraft,
} from "../../app/study/chancellorConsultSubmission";
import type { StudyRecentRepliesState } from "../../app/study/studyRecentReplies";
import type { QintianDecisionRadarView } from "../../app/study/qintianDecisionRadar";
import type { QintianContext } from "../../app/study/qintianWorkspaceState";
import { formatBusinessTime } from "../../lib/formatBusinessTime";
import { AdvisorDrawerShell } from "./AdvisorDrawerShell";
import advisorStyles from "./AdvisorDrawerShell.module.css";
import { QintianPanel } from "./QintianPanel";
import styles from "./StudySideDrawers.module.css";

export interface StudySideDrawersProps {
  qintianRadar: QintianDecisionRadarView;
  qintianContext: QintianContext;
  onPrefillDecree(value: string): void;
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
  const [closing, setClosing] = useState<"left" | "right" | null>(null);
  const [drawerBounds, setDrawerBounds] = useState<{ top: number; height: number } | null>(null);
  const [draft, setDraft] = useState("");
  const leftTriggerRef = useRef<HTMLButtonElement>(null);
  const rightTriggerRef = useRef<HTMLButtonElement>(null);

  function close(side: StudyDrawerSide, restoreFocus = true) {
    if (side === "right" && window.location.hash === "#qintian") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    if (!restoreFocus) {
      setOpen(null);
      setClosing(null);
      return;
    }
    setOpen(null);
    setClosing(side);
  }

  function finishClose(side: StudyDrawerSide) {
    if (closing !== side) return;
    setClosing(null);
    (side === "left" ? leftTriggerRef.current : rightTriggerRef.current)?.focus();
  }

  function openDrawer(side: StudyDrawerSide) {
    setClosing(null);
    setOpen(side);
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
    const openQintianFromHash = () => {
      if (window.location.hash === "#qintian") openDrawer("right");
    };
    openQintianFromHash();
    window.addEventListener("hashchange", openQintianFromHash);
    return () => window.removeEventListener("hashchange", openQintianFromHash);
  }, []);
  useEffect(() => {
    const measureBounds = () => {
      const content = document.querySelector<HTMLElement>('[data-layout-region="content"]');
      if (!content) {
        setDrawerBounds(null);
        return;
      }
      const rect = content.getBoundingClientRect();
      setDrawerBounds({ top: Math.max(0, rect.top), height: Math.max(0, rect.height + 1) });
    };
    measureBounds();
    window.addEventListener("resize", measureBounds);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureBounds);
    const regions = document.querySelectorAll<HTMLElement>(
      '[data-app-layout="header-content-footer"], [data-layout-region="header"], [data-layout-region="content"], [data-layout-region="footer"]',
    );
    regions.forEach((region) => observer?.observe(region));
    return () => {
      window.removeEventListener("resize", measureBounds);
      observer?.disconnect();
    };
  }, [open, closing]);

  const rendered = open ?? closing;
  const phase = closing ? "closing" as const : "opening" as const;
  const leftActive = rendered === "left";
  const rightActive = rendered === "right";
  const leftOpen = open === "left";
  const rightOpen = open === "right";
  const leftToggleLabel = leftOpen ? "关闭上书房左侧抽屉" : "打开上书房左侧抽屉";
  const rightToggleLabel = rightOpen ? "关闭上书房右侧抽屉" : "打开上书房右侧抽屉";
  const drawerToggleTop = drawerBounds
    ? drawerBounds.top + drawerBounds.height / 2
    : "50%";

  return (
    <>
      <button
        ref={leftTriggerRef}
        className={`${styles.trigger} ${styles.leftTrigger}`}
        type="button"
        data-drawer-side="left"
        data-drawer-phase={leftActive ? phase : "closed"}
        style={{ top: drawerToggleTop }}
        onAnimationEnd={() => finishClose("left")}
        aria-label={leftToggleLabel}
        aria-expanded={leftOpen}
        aria-controls="chancellor-advisor-drawer"
        onClick={leftOpen ? () => close("left") : () => {
          openDrawer("left");
          props.onOpenRecentReplies();
        }}
      >
        <span className={styles.triggerIcon} aria-hidden="true">
          <span className={styles.triggerArrow} />
        </span>
      </button>
      <button
        ref={rightTriggerRef}
        className={`${styles.trigger} ${styles.rightTrigger}`}
        type="button"
        data-drawer-side="right"
        data-drawer-phase={rightActive ? phase : "closed"}
        style={{ top: drawerToggleTop }}
        onAnimationEnd={() => finishClose("right")}
        aria-label={rightToggleLabel}
        aria-expanded={rightOpen}
        aria-controls="qintian-advisor-drawer"
        onClick={rightOpen ? () => close("right") : () => openDrawer("right")}
      >
        <span className={styles.triggerIcon} aria-hidden="true">
          <span className={styles.triggerArrow} />
        </span>
      </button>
      {open && <button className={styles.backdrop} type="button" aria-label="关闭抽屉" onClick={() => close(open)} />}
      {rendered === "left" && <AdvisorDrawerShell
        id="chancellor-advisor-drawer"
        side="left"
        phase={phase}
        bounds={drawerBounds}
        portrait="/heroes/character-roster/v5-command-center-zhuge-liang.webp"
        name="丞相"
        duty="辅政之臣 · 总揽要务"
        testId="chancellor-advisor-drawer"
        footer={<section className={`${styles.drawerConversation} ${styles.chat}`}>
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
              className={advisorStyles.composerInput}
              style={{ "--chat-accent": "#F0C66A" } as CSSProperties}
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
            <button className={`${styles.sendButton} ${advisorStyles.composerButton}`} type="submit" aria-label="发送" disabled={props.pending || !draft.trim()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.7 3.4 21 11.2a.9.9 0 0 1 0 1.6L3.7 20.6a.9.9 0 0 1-1.2-1l1.2-6.1 9.1-1.5-9.1-1.5-1.2-6.1a.9.9 0 0 1 1.2-1Z" /></svg>
            </button>
          </form>
        </section>}
      >
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
      </AdvisorDrawerShell>}
      {rendered === "right" && (
        <QintianPanel
          radar={props.qintianRadar}
          context={props.qintianContext}
          onPrefillDecree={props.onPrefillDecree}
          renderLayout={(body, footer) => (
            <AdvisorDrawerShell
              id="qintian-advisor-drawer"
              side="right"
              phase={phase}
              bounds={drawerBounds}
              portrait="/shangshufang/portrait-qintian.webp"
              name="钦天监"
              duty="观星导师 · 先知用法"
              testId="qintian-advisor-drawer"
              footer={footer}
            >
              {body}
            </AdvisorDrawerShell>
          )}
        />
      )}
    </>
  );
}
