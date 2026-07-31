"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";

import {
  consultQintianFromBrowser,
  createQintianForecastFromBrowser,
  loadPendingQintianTriggersFromBrowser,
  reviewQintianForecastFromBrowser,
} from "../../app/study/qintianBrowserClient";
import type {
  QintianReviewDecision,
} from "../../app/study/qintianContracts";
import type { QintianDecisionRadarView } from "../../app/study/qintianDecisionRadar";
import { shouldSubmitConsultKey } from "../../app/study/chancellorConsultSubmission";
import {
  initialQintianWorkspaceState,
  projectQintianWorkspaceMode,
  qintianWorkspaceReducer,
  type QintianContext,
} from "../../app/study/qintianWorkspaceState";
import advisorStyles from "./AdvisorDrawerShell.module.css";
import styles from "./QintianPanel.module.css";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface QintianPanelProps {
  radar: QintianDecisionRadarView;
  context: QintianContext;
  onPrefillDecree(value: string): void;
  renderLayout?(body: ReactNode, footer: ReactNode): ReactNode;
}

const REVIEW_OPTIONS: Array<{ value: QintianReviewDecision; label: string }> = [
  { value: "KEEP", label: "保持原判断" },
  { value: "INVALIDATE", label: "判断已失效" },
  { value: "REQUEST_RERUN", label: "重新推演" },
  { value: "ESCALATE_TO_CHANCELLOR", label: "转丞相裁决" },
];

function defaultReviewAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

function scenarioLabel(kind: string): string {
  return kind === "OPTIMISTIC" ? "乐观情景" : kind === "BASELINE" ? "基准情景" : "悲观情景";
}

export function QintianPanel({ radar, context, renderLayout }: QintianPanelProps) {
  const [state, dispatch] = useReducer(qintianWorkspaceReducer, {
    ...initialQintianWorkspaceState,
    contextKey: context.key,
    subject: context.subject,
  });
  const [question, setQuestion] = useState("未来 90 天，什么信号会改变当前判断，是否值得继续？");
  const [reviewDecision, setReviewDecision] = useState<QintianReviewDecision>("KEEP");
  const [observation, setObservation] = useState("");
  const [judgmentInvalidated, setJudgmentInvalidated] = useState<boolean | null>(null);
  const [reviewPending, setReviewPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const requestCounter = useRef(0);
  const contextRef = useRef(context.key);

  useEffect(() => {
    contextRef.current = context.key;
    dispatch({ type: "CONTEXT_CHANGED", contextKey: context.key, subject: context.subject });
  }, [context.key, context.subject]);

  useEffect(() => {
    let active = true;
    void loadPendingQintianTriggersFromBrowser().then((result) => {
      if (active && result.ok) {
        dispatch({ type: "TRIGGERS_LOADED", contextKey: context.key, triggers: result.data });
      }
    });
    return () => { active = false; };
  }, [context.key]);

  const mode = projectQintianWorkspaceMode({
    pageMode: radar.mode,
    formalPhase: state.formalPhase,
    dueTriggers: state.dueTriggers,
  });

  async function startForecast() {
    const requestId = requestCounter.current + 1;
    requestCounter.current = requestId;
    const contextKey = context.key;
    dispatch({ type: "FORECAST_STARTED", contextKey, requestId });
    const result = await createQintianForecastFromBrowser({
      idempotencyKey: `${context.subject.id}-${Date.now()}`,
      subject: context.subject,
      question,
      evidenceRefs: [],
      reviewAt: defaultReviewAt(),
    });
    if (contextRef.current !== contextKey) return;
    if (result.ok) {
      dispatch({ type: "FORECAST_SUCCEEDED", contextKey, requestId, forecast: result.data });
      return;
    }
    dispatch({
      type: "FORECAST_FAILED",
      contextKey,
      requestId,
      kind: result.kind === "provider_unavailable" ? "provider_unavailable" : "error",
      message: result.kind === "provider_unavailable"
        ? `${result.message}，服务暂不可用，未生成正式推演。`
        : result.message,
    });
  }

  async function submitReview() {
    const trigger = state.dueTriggers[0];
    if (!trigger || !observation.trim() || judgmentInvalidated === null) return;
    setReviewPending(true);
    const result = await reviewQintianForecastFromBrowser(trigger.forecastId, {
      triggerId: trigger.id,
      decision: reviewDecision,
      observation: observation.trim(),
      judgmentInvalidated,
    });
    setReviewPending(false);
    if (!result.ok) return;
    dispatch({ type: "TRIGGER_REVIEWED", triggerId: trigger.id });
    setObservation("");
    setJudgmentInvalidated(null);
  }

  async function sendChat() {
    const content = chatDraft.trim();
    if (!content || chatPending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setChatDraft("");
    setChatPending(true);
    setChatError(null);
    const result = await consultQintianFromBrowser(nextMessages);
    setChatPending(false);
    if (result.ok) {
      setMessages([...nextMessages, { role: "assistant", content: result.data.reply }]);
    } else {
      setChatError(result.kind === "provider_unavailable"
        ? `${result.message}；未伪造实时判断。`
        : result.message);
    }
  }

  const body = (
      <section className={styles.workspace} data-qintian-workspace-mode={mode}>
        {mode === "TRIGGER_DUE" && state.dueTriggers[0] && (
          <section className={styles.review} aria-label="钦天监到期复核">
            <h3>到期复核</h3>
            <p className={styles.notice}>
              原判断：{state.dueTriggers[0].forecastSummary}<br />
              待核信号定义：{state.dueTriggers[0].signal} · {state.dueTriggers[0].threshold} · {state.dueTriggers[0].window}
            </p>
            <textarea className={styles.note} aria-label="实际新观察" placeholder="填写实际观察到的新证据、数值与时间窗口" value={observation} onChange={(event) => setObservation(event.target.value)} />
            <fieldset className={styles.reviewChoices}>
              <legend>原判断是否已经失效？</legend>
              <label><input type="radio" name="qintian-invalidated" checked={judgmentInvalidated === false} onChange={() => setJudgmentInvalidated(false)} />否，判断仍成立</label>
              <label><input type="radio" name="qintian-invalidated" checked={judgmentInvalidated === true} onChange={() => setJudgmentInvalidated(true)} />是，判断已失效</label>
            </fieldset>
            <div className={styles.reviewChoices}>
              {REVIEW_OPTIONS.map((option) => (
                <label key={option.value}><input type="radio" name="qintian-review" value={option.value} checked={reviewDecision === option.value} onChange={() => setReviewDecision(option.value)} />{option.label}</label>
              ))}
            </div>
            <button className={styles.action} type="button" disabled={reviewPending || !observation.trim() || judgmentInvalidated === null} onClick={submitReview}>
              {reviewPending ? "提交复核中…" : "确认复核"}
            </button>
          </section>
        )}

        <article className={styles.notebook}>
          <p className={styles.notebookKicker}>{state.forecast ? "正式推演摘记" : "观星札记"}</p>
          <p className={styles.notebookSummary}>{state.forecast?.judgment ?? radar.summary}</p>
          {!state.forecast && radar.sections.slice(0, 3).map((section) => (
            <section className={styles.radarSection} key={section.label}>
              <h3>{section.label}</h3>
              <ul className={styles.list}>{section.items.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          ))}
          {state.forecast && (
            <dl className={styles.meta}>
              <dt>置信依据</dt><dd>{state.forecast.confidence} · {state.forecast.confidenceBasis}</dd>
              <dt>复核日期</dt><dd>{new Date(state.forecast.reviewAt).toLocaleString("zh-CN")}</dd>
            </dl>
          )}
        </article>

        <details className={styles.forecastDisclosure}>
          <summary>{state.forecast ? "展开正式推演全卷" : "发起正式推演"}</summary>
          {state.forecast ? (
            <section className={styles.formal} aria-label="正式推演结果">
              <h3>正式推演 · {state.forecast.judgment}</h3>
              <dl className={styles.meta}>
                <dt>置信依据</dt><dd>{state.forecast.confidence} · {state.forecast.confidenceBasis}</dd>
                <dt>复核日期</dt><dd>{new Date(state.forecast.reviewAt).toLocaleString("zh-CN")}</dd>
                <dt>人工签字</dt><dd>{state.forecast.humanSignoffRequired ? "必须人工签字后才能据此作不可逆决定" : "仍建议人工复核"}</dd>
              </dl>
              <div className={styles.scenarioGrid}>
                {state.forecast.scenarios.map((scenario) => (
                  <article className={styles.scenario} key={scenario.kind}>
                    <h4>{scenarioLabel(scenario.kind)}</h4>
                    <p>{scenario.summary} · {scenario.impact} · {scenario.timeWindow}</p>
                    <p>概率区间：{scenario.probabilityInterval ? `${Math.round(scenario.probabilityInterval.lower * 100)}%–${Math.round(scenario.probabilityInterval.upper * 100)}%` : "暂无可辩护的概率区间"}</p>
                    <p><strong>反事实：</strong>{scenario.counterfactual}</p>
                    {scenario.kind === "PESSIMISTIC" && <p><strong>最坏情况：</strong>{scenario.impact}</p>}
                  </article>
                ))}
              </div>
              <h3>关键假设</h3>
              <ul className={styles.list}>{state.forecast.assumptions.map((item) => <li key={item.statement}>{item.critical ? "关键 · " : ""}{item.statement}</li>)}</ul>
              <h3>证据与更新时间</h3>
              <ul className={styles.list}>{state.forecast.evidenceRefs.map((item) => <li key={item.id}>{item.summary} · {item.source} · {item.asOf ? new Date(item.asOf).toLocaleString("zh-CN") : "未提供更新时间"}</li>)}</ul>
              <h3>触发器</h3>
              <ul className={styles.list}>{state.forecast.triggers.map((item) => <li key={item.id}>{item.signal} · {item.threshold} · {item.window}</li>)}</ul>
              <p className={styles.notice}>{state.forecast.disclaimer}</p>
            </section>
          ) : (
            <section className={styles.formal}>
              <textarea className={styles.question} aria-label="正式推演问题" value={question} onChange={(event) => setQuestion(event.target.value)} />
              <button className={styles.action} type="button" disabled={state.formalPhase === "pending" || !question.trim()} onClick={startForecast}>
                {state.formalPhase === "pending" ? "推演中…" : "发起正式推演"}
              </button>
              {state.error && <p className={styles.error} role="alert">{state.error}</p>}
            </section>
          )}
        </details>
      </section>
  );
  const footer = (
      <section className={styles.conversation}>
        <h3>问钦天监</h3>
        <div className={styles.messages} aria-live="polite">
          {messages.length === 0 && <p className={styles.emptyMessage}>可询问时机、风险与改变判断的信号。</p>}
          {messages.map((message, index) => (
            <div className={styles.messageRow} data-role={message.role} key={`${message.role}-${index}`}>
              <Image className={styles.avatar} src={message.role === "user" ? "/shangshufang/portrait-wang.webp" : "/shangshufang/portrait-qintian.webp"} alt={message.role === "user" ? "陛下" : "钦天监"} width={36} height={36} />
              <div className={styles.messageContent}>
                <span className={styles.messageAuthor}>{message.role === "user" ? "陛下" : "钦天监"}</span>
                <p className={styles.messageBubble}>{message.content}</p>
              </div>
            </div>
          ))}
          {chatPending && (
            <div className={styles.messageRow} data-role="assistant">
              <Image className={styles.avatar} src="/shangshufang/portrait-qintian.webp" alt="钦天监" width={36} height={36} />
              <div className={styles.messageContent}><span className={styles.messageAuthor}>钦天监</span><p className={styles.messageBubble}>正在观测当前信息…</p></div>
            </div>
          )}
        </div>
        {chatError && <p className={styles.error} role="alert">{chatError}</p>}
        <form className={styles.chatForm} onSubmit={(event) => { event.preventDefault(); void sendChat(); }}>
          <textarea
            className={advisorStyles.composerInput}
            style={{ "--chat-accent": "#7EC8E3" } as CSSProperties}
            aria-label="向钦天监提问"
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            onKeyDown={(event) => {
              if (!shouldSubmitConsultKey({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing })) return;
              event.preventDefault();
              void sendChat();
            }}
            placeholder="询问时机、风险、下一步"
          />
          <button className={`${styles.sendButton} ${advisorStyles.composerButton}`} type="submit" aria-label="发送" disabled={chatPending || !chatDraft.trim()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.7 3.4 21 11.2a.9.9 0 0 1 0 1.6L3.7 20.6a.9.9 0 0 1-1.2-1l1.2-6.1 9.1-1.5-9.1-1.5-1.2-6.1a.9.9 0 0 1 1.2-1Z" /></svg>
          </button>
        </form>
      </section>
  );

  if (renderLayout) return renderLayout(body, footer);
  return (
    <div className={styles.panel} data-qintian-workspace-mode={mode}>
      {body}
      {footer}
    </div>
  );
}
