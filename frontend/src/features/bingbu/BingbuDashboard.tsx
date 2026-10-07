"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import styles from "./bingbu.module.css";

type View = "overview" | "detail" | "war-room" | "import";
type JsonRecord = Record<string, unknown>;
type LoadState = "loading" | "ready" | "error" | "unauthorized";

const STAGE_LABELS: Record<string, string> = {
  qualified: "已合格", discovery: "需求探索", proposal: "报价中",
  negotiation: "谈判中", won: "已赢单", lost: "已输单",
};
const HEALTH_LABELS: Record<string, string> = { green: "顺风", amber: "需盯办", red: "告急", unknown: "待判定" };

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
}
function unwrap(value: unknown): JsonRecord { const root = asRecord(value); return asRecord(root?.data) ?? root ?? {}; }
function text(value: unknown, fallback = "待补") { return typeof value === "string" && value.trim() ? value : fallback; }
function records(value: unknown): JsonRecord[] { return Array.isArray(value) ? value.map(asRecord).filter((item): item is JsonRecord => item !== null) : []; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []; }
function stageLabel(value: unknown) { return STAGE_LABELS[String(value)] ?? text(value, "未分阶段"); }
function formatAmount(value: unknown) { const amount = typeof value === "number" ? value : Number(value); return Number.isFinite(amount) ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(amount) : "—"; }
function healthClass(value: unknown) {
  const tone = String(value);
  return `${styles.health} ${tone === "red" ? styles.healthRed : tone === "amber" ? styles.healthAmber : tone === "green" ? styles.healthGreen : styles.healthUnknown}`;
}

export function BingbuDashboard({ view = "overview", opportunityId }: { view?: View; opportunityId?: string }) {
  const path = view === "overview" ? "/api/bingbu/overview" : view === "detail" ? `/api/bingbu/opportunities/${encodeURIComponent(opportunityId ?? "")}` : "/api/bingbu/war-rooms";
  const [payload, setPayload] = useState<unknown>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("兵部战报暂时不可用，请稍后重试。");

  useEffect(() => {
    let active = true;
    const init: RequestInit = view === "war-room" ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ opportunity_id: opportunityId }) } : {};
    if (view === "import") return () => { active = false; };
    void fetch(path, { ...init, cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!active) return;
      if (response.status === 401) { setErrorMessage("登录状态已失效，请重新进入朝堂。"); setState("unauthorized"); return; }
      if (!response.ok || asRecord(body)?.status === "error") { setErrorMessage(text(asRecord(body)?.message, "兵部战报暂时不可用，请稍后重试。")); setState("error"); return; }
      setPayload(body); setState("ready");
    }).catch(() => { if (active) { setErrorMessage("无法连接兵部服务，请检查本地后端状态。"); setState("error"); } });
    return () => { active = false; };
  }, [opportunityId, path, view]);

  if (view === "import") return <ImportPanel />;
  if (state === "loading") return <LoadingBoard />;
  if (state === "unauthorized") return <StateCard title="需要重新入朝" message={errorMessage} action={<Link className={styles.textLink} href="/login">返回登录</Link>} />;
  if (state === "error") return <StateCard title="战报未能展开" message={errorMessage} action={<Link className={styles.textLink} href="/bingbu">重新查看</Link>} />;
  return <SalesBoard view={view} payload={payload} />;
}

function LoadingBoard() {
  return <main className={`${styles.page} ${styles.loadingBoard}`} aria-busy="true" aria-live="polite"><div className={styles.skeletonKicker} /><div className={styles.skeletonTitle} /><div className={styles.skeletonGrid}>{[1, 2, 3, 4].map((item) => <div className={styles.skeletonCard} key={item} />)}</div><p className={styles.loadingCopy}>正在从事实层读取兵部战报…</p></main>;
}
function StateCard({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <main className={styles.page}><section className={styles.stateCard} role="alert"><span className={styles.sectionMark}>兵部 / 状态</span><h1>{title}</h1><p>{message}</p>{action}</section></main>;
}

function SalesBoard({ view, payload }: { view: View; payload: unknown }) {
  const data = unwrap(payload);
  if (view === "detail") return <OpportunityDetail data={data} />;
  if (view === "war-room") return <WarRoom data={data} />;
  const opportunities = records(data.priority_opportunities);
  const gaps = strings(data.evidence_gaps);
  const queue = records(data.decision_queue);
  const funnel = asRecord(data.funnel);
  const counts = asRecord(funnel?.counts) ?? {};
  const pipeline = opportunities.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const urgent = opportunities.filter((item) => item.health === "red" || item.health === "amber").length;
  return <main className={styles.page}>
    <header className={styles.hero}><div><span className={styles.sectionMark}>兵部 / Revenue OS · P0 作战台</span><h1>把销售事实，变成下一步。</h1><p className={styles.lede}>事实归 CRM，判断归兵部。每个活跃商机只保留一个责任人、一个动作和一个截止时间。</p></div><div className={styles.heroActions}><span className={styles.providerBadge}>DeepSeek-first · 人工审批</span><Link className={styles.primaryButton} href="/bingbu/import">导入销售事实</Link></div></header>
    <section className={styles.metrics} aria-label="兵部经营摘要"><Metric label="重点商机" value={opportunities.length} detail={`告急 / 需盯办 ${urgent} 个`} tone="accent" /><Metric label="当前管道" value={`¥${formatAmount(pipeline)}`} detail="以当前事实快照为准" /><Metric label="证据缺口" value={gaps.length} detail="缺证据时结论自动降级" tone={gaps.length ? "warning" : "normal"} /><Metric label="待会审" value={queue.length} detail="只生成草案，不执行外部动作" /></section>
    <div className={styles.commandGrid}><section className={`${styles.panel} ${styles.priorityPanel}`} aria-labelledby="priority-title"><div className={styles.panelHeader}><div><span className={styles.sectionMark}>今日军报</span><h2 id="priority-title">重点商机队列</h2></div><span className={styles.asOf}>截至 {text(asRecord(data.freshness)?.as_of, "当前")}</span></div>{opportunities.length ? <div className={styles.opportunityList}>{opportunities.map((item, index) => <OpportunityRow item={item} index={index} key={text(item.id, String(index))} />)}</div> : <EmptyState title="事实层还没有商机" message="导入 CSV 或 JSON 后，兵部会按金额、停滞和证据完整度排出优先级。" action="去导入" href="/bingbu/import" />}</section><aside className={styles.rail}><section className={styles.panel} aria-labelledby="funnel-title"><div className={styles.panelHeader}><div><span className={styles.sectionMark}>漏斗态势</span><h2 id="funnel-title">阶段停滞</h2></div></div><div className={styles.funnel}>{Object.entries(counts).length ? Object.entries(counts).map(([key, value]) => <div className={styles.funnelRow} key={key}><span>{stageLabel(key)}</span><strong>{String(value)}</strong></div>) : <p className={styles.muted}>导入后显示阶段分布。</p>}</div></section><section className={styles.panel} aria-labelledby="evidence-title"><div className={styles.panelHeader}><div><span className={styles.sectionMark}>证据脊</span><h2 id="evidence-title">待补证据</h2></div></div>{gaps.length ? <ul className={styles.alertList}>{gaps.slice(0, 5).map((gap) => <li key={gap}>{gap}</li>)}</ul> : <p className={styles.positive}>当前没有未标记的证据缺口。</p>}</section></aside></div><footer className={styles.footerNote}>兵部只生成事实化判断与待审批草案；发送消息、改价、签约、更新 CRM 和承诺交付均留在独立 Action Gateway。</footer>
  </main>;
}

function Metric({ label, value, detail, tone = "normal" }: { label: string; value: string | number; detail: string; tone?: "normal" | "accent" | "warning" }) {
  return <article className={`${styles.metric} ${tone === "accent" ? styles.metricAccent : tone === "warning" ? styles.metricWarning : ""}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
function OpportunityRow({ item, index }: { item: JsonRecord; index: number }) {
  const id = text(item.id, `opportunity-${index}`);
  const health = String(item.health ?? "unknown");
  return <article className={styles.opportunity} style={{ "--row-delay": `${index * 70}ms` } as CSSProperties}><div className={styles.opportunityRank}>{String(index + 1).padStart(2, "0")}</div><div className={styles.opportunityMain}><div className={styles.opportunityTitle}><Link href={`/bingbu/opportunities/${encodeURIComponent(id)}`}>{text(item.account_name, "未命名客户")}</Link><span className={healthClass(health)}>{HEALTH_LABELS[health] ?? "待判定"}</span></div><div className={styles.opportunityMeta}><span>{stageLabel(item.stage)}</span><span>¥{formatAmount(item.amount)} {text(item.currency, "CNY")}</span><span>责任人 {text(item.next_action_owner, "待指定")}</span></div><p>{text(item.next_action, "待补唯一下一步")}</p></div><div className={styles.opportunityActions}><Link className={styles.quietButton} href={`/bingbu/war-room/${encodeURIComponent(id)}`}>生成会审包</Link><Link className={styles.arrowLink} href={`/bingbu/opportunities/${encodeURIComponent(id)}`}>查看事实 →</Link></div></article>;
}

function OpportunityDetail({ data }: { data: JsonRecord }) {
  const evidence = records(data.evidence);
  const activities = records(data.activities);
  return <main className={styles.page}><div className={styles.breadcrumb}><Link href="/bingbu">兵部作战台</Link><span>/</span><span>商机详情</span></div><header className={styles.detailHero}><div><span className={styles.sectionMark}>兵部 / 商机事实</span><h1>{text(data.account_name, "商机详情")}</h1><p className={styles.lede}>唯一下一步：<strong>{text(data.next_action, "待补证据")}</strong></p></div><span className={healthClass(data.health)}>{HEALTH_LABELS[String(data.health)] ?? "待判定"}</span></header><section className={styles.nextAction}><span>唯一下一步</span><strong>{text(data.next_action, "待补唯一下一步")}</strong><small>责任人：{text(data.next_action_owner, "待指定")} · 截止：{text(data.next_action_due_at, "待指定")}</small></section><div className={styles.detailGrid}><section className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.sectionMark}>事实层</span><h2>商机摘要</h2></div></div><dl className={styles.factList}><Fact label="阶段" value={stageLabel(data.stage)} /><Fact label="金额" value={`¥${formatAmount(data.amount)} ${text(data.currency, "CNY")}`} /><Fact label="负责人" value={text(data.owner_user_id, "当前用户")} /><Fact label="预计成交" value={text(data.expected_close_date, "未设定")} /><Fact label="来源" value={text(data.source_ref, "未登记")} /></dl></section><section className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.sectionMark}>证据脊</span><h2>事实与缺口</h2></div></div>{evidence.length ? <ul className={styles.evidenceList}>{evidence.map((item) => <li key={text(item.id)}><strong>{text(item.claim)}</strong><span>{text(item.source_type)} · {text(item.observed_at, "时间未知")} · 置信度 {text(item.confidence, "未标记")}</span></li>)}</ul> : <EmptyState title="暂无可引用证据" message="当前会审将自动降级，不会替客户或销售补写事实。" />}</section></div><section className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.sectionMark}>活动时间线</span><h2>最近动作</h2></div></div>{activities.length ? <ol className={styles.timeline}>{activities.map((item) => <li key={text(item.id)}><span>{text(item.occurred_at, "时间未知")}</span><strong>{text(item.summary)}</strong><small>{text(item.actor, "未知执行人")} · {text(item.customer_signal, "无客户信号记录")}</small></li>)}</ol> : <p className={styles.muted}>尚无活动记录；导入事实时可一并带入活动时间线。</p>}</section><div className={styles.bottomActions}><Link className={styles.primaryButton} href={`/bingbu/war-room/${encodeURIComponent(text(data.id, ""))}`}>生成销售会审包</Link><Link className={styles.quietButton} href="/bingbu">返回作战台</Link></div></main>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }

function WarRoom({ data }: { data: JsonRecord }) {
  const packet = asRecord(data.decision_packet) ?? {};
  const draft = asRecord(data.action_draft) ?? {};
  const packetSections = [["事实", "facts"], ["假设", "assumptions"], ["建议", "recommendations"], ["证据缺口", "evidence_gaps"], ["红线", "redlines"]] as const;
  return <main className={styles.page}><div className={styles.breadcrumb}><Link href="/bingbu">兵部作战台</Link><span>/</span><span>销售会审包</span></div><header className={styles.detailHero}><div><span className={styles.sectionMark}>兵部 / 作战简报</span><h1>{text(packet.summary, "销售会审包")}</h1><p className={styles.lede}>本包只提供可追溯判断和待审批动作，不代表任何现实动作已经执行。</p></div><span className={packet.status === "ready" ? styles.healthGreen : styles.healthAmber}>{packet.status === "ready" ? "证据完整" : "降级审议"}</span></header><section className={styles.briefGrid}>{packetSections.map(([label, key]) => <article className={`${styles.briefCard} ${key === "redlines" ? styles.redlineCard : ""}`} key={key}><span className={styles.sectionMark}>{label}</span><ul>{strings(packet[key]).length ? strings(packet[key]).map((item) => <li key={item}>{item}</li>) : <li className={styles.muted}>暂无记录</li>}</ul></article>)}</section><section className={styles.nextAction}><span>会审结论中的唯一下一步</span><strong>{text(packet.next_action, "待补证据后指定")}</strong><small>影响司局：{strings(packet.cross_bureau_impacts).join("、") || "待会审"}</small></section><ActionDraftCard draft={draft} /></main>;
}
function ActionDraftCard({ draft }: { draft: JsonRecord }) {
  const [state, setState] = useState(text(draft.approval_state, "DRAFT"));
  const [busy, setBusy] = useState(false);
  const draftId = text(draft.id, "");
  const mutate = async (action: "approve" | "reject") => { if (!draftId) return; setBusy(true); try { const response = await fetch(`/api/bingbu/action-drafts/${encodeURIComponent(draftId)}/${action}`, { method: "POST" }); const body = await response.json().catch(() => null); if (response.ok) setState(text(asRecord(asRecord(body)?.data)?.approval_state, state)); } finally { setBusy(false); } };
  return <section className={styles.actionDraft}><div><span className={styles.sectionMark}>待审批动作草案</span><h2>{text(draft.action_type, "客户跟进")}</h2><p>批准后仍停留在待执行状态，由独立 Action Gateway 处理；兵部不会发送消息或写回 CRM。</p></div><div className={styles.draftMeta}><strong>{state}</strong><small>幂等键：{text(draft.idempotency_key, "未生成")}</small></div><div className={styles.buttonRow}>{state === "DRAFT" ? <><button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void mutate("approve")}>{busy ? "处理中…" : "批准草案"}</button><button className={styles.quietButton} type="button" disabled={busy} onClick={() => void mutate("reject")}>退回</button></> : <span className={styles.positive}>状态已锁定：{state}</span>}</div></section>;
}

function ImportPanel() {
  const [value, setValue] = useState("id,account_name,stage,amount,next_action,next_action_owner,next_action_due_at,source_ref\nopp-1,示例客户,discovery,100000,确认决策人,owner,2030-01-01T00:00:00Z,fixture:1");
  const [sourceType, setSourceType] = useState<"csv" | "json">("csv");
  const [message, setMessage] = useState("先预览，确认错误行后再提交。");
  const [preview, setPreview] = useState<JsonRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (endpoint: "preview" | "commit") => {
    setBusy(true);
    try {
      const response = await fetch(`/api/bingbu/imports/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: sourceType === "csv" ? "sales.csv" : "sales.json", source_type: sourceType, content: value }),
      });
      const body = await response.json().catch(() => null);
      const data = asRecord(asRecord(body)?.data);
      if (!response.ok || asRecord(body)?.status === "error") {
        setMessage(text(asRecord(body)?.message, "导入失败，请检查格式。"));
      } else if (data) {
        if (endpoint === "preview") setPreview(data);
        setMessage(`${endpoint === "preview" ? "预览" : "提交"}完成：接受 ${text(data.accepted_count, "0")} 行，拒绝 ${text(data.rejected_count, "0")} 行。`);
      }
    } catch {
      setMessage("无法连接兵部服务，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };
  const errors = records(preview?.errors);
  return <main className={styles.page}>
    <div className={styles.breadcrumb}><Link href="/bingbu">兵部作战台</Link><span>/</span><span>导入销售事实</span></div>
    <header className={styles.hero}><div><span className={styles.sectionMark}>兵部 / 事实入口</span><h1>先验收，再入账。</h1><p className={styles.lede}>导入只写入当前用户自己的事实空间。兵部不会替你补写负责人、阶段、金额或下一步。</p></div></header>
    <section className={styles.importLayout}>
      <div className={styles.panel}>
        <div className={styles.sourceTabs}><button className={sourceType === "csv" ? styles.tabActive : styles.tab} type="button" onClick={() => setSourceType("csv")}>CSV</button><button className={sourceType === "json" ? styles.tabActive : styles.tab} type="button" onClick={() => setSourceType("json")}>JSON</button></div>
        <label className={styles.srOnly} htmlFor="bingbu-import-content">销售事实内容</label>
        <textarea id="bingbu-import-content" className={styles.importBox} value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false} />
        <div className={styles.buttonRow}><button className={styles.primaryButton} type="button" disabled={busy || !value.trim()} onClick={() => void submit("preview")}>{busy ? "读取中…" : "预览错误"}</button><button className={styles.quietButton} type="button" disabled={busy || !preview || Number(preview.rejected_count) > 0} onClick={() => void submit("commit")}>提交导入</button></div>
        <p className={styles.liveMessage} aria-live="polite">{message}</p>
      </div>
      <aside className={styles.panel}>
        <span className={styles.sectionMark}>预览回执</span><h2>{preview ? `第 ${text(preview.id, "—")} 次预览` : "等待预览"}</h2>
        {errors.length ? <ul className={styles.alertList}>{errors.map((error) => <li key={`${text(error.row)}-${text(error.field)}`}>第 {text(error.row)} 行 · {text(error.field)}：{text(error.message)}</li>)}</ul> : <p className={styles.muted}>提交前必须先完成一次无错误预览。</p>}
        <ul className={styles.importRules}><li>重复内容按指纹幂等，不会重复写入。</li><li>客户端 owner_id 会被忽略，责任人来自认证会话。</li><li>证据不足的商机仍会入账，但会审包会明确降级。</li></ul>
      </aside>
    </section>
  </main>;
}
function EmptyState({ title, message, action, href }: { title: string; message: string; action?: string; href?: string }) { return <div className={styles.emptyState}><span className={styles.sectionMark}>暂无记录</span><h3>{title}</h3><p>{message}</p>{action && href ? <Link className={styles.quietButton} href={href}>{action}</Link> : null}</div>; }
