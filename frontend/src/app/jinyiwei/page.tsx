"use client";

import { useEffect, useRef, useState } from "react";
import type { JinyiweiDetail, JinyiweiEvidence, JinyiweiListItem, JinyiweiPage, JinyiweiStatus, JinyiweiSummary } from "../../lib/backendClient";
import { buildInvestigationQuery, createGenerationGuard, formatConfidence, getPageAvailability, qualityPresentation, resetDetailForListRefresh, statusPresentation } from "./jinyiweiStatus";
import "./jinyiwei.css";

type Filter = JinyiweiStatus | "ALL";
type Loadable<T> = {phase:"loading"}|{phase:"error";message:string}|{phase:"ready";data:T};
const FILTERS: {value:Filter;label:string}[]=[{value:"ALL",label:"全部"},{value:"RESOLVED",label:"已解决"},{value:"PARTIAL",label:"部分解决"},{value:"BLOCKED",label:"受阻"},{value:"UNAVAILABLE",label:"不可用"}];
const LIMIT=20;

function safeMessage(body:unknown,fallback:string):string {
  if(typeof body==="object"&&body!==null&&typeof (body as {message?:unknown}).message==="string")return (body as {message:string}).message;
  return fallback;
}
async function readJson(response:Response):Promise<unknown>{try{return await response.json();}catch{return null;}}
function when(value:string):string {const date=new Date(value);return Number.isNaN(date.valueOf())?"时间未核验":date.toLocaleString("zh-CN",{hour12:false});}
function valueText(value:unknown):string {return typeof value==="string"?value:JSON.stringify(value,null,2);}

export default function JinyiweiPage(){
  const [summary,setSummary]=useState<Loadable<JinyiweiSummary>>({phase:"loading"});
  const [page,setPage]=useState<Loadable<JinyiweiPage>>({phase:"loading"});
  const [detail,setDetail]=useState<Loadable<JinyiweiDetail>|null>(null);
  const [filter,setFilter]=useState<Filter>("ALL");
  const [offset,setOffset]=useState(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [summaryRetry,setSummaryRetry]=useState(0),[listRetry,setListRetry]=useState(0),[detailRetry,setDetailRetry]=useState(0);
  const listAbort=useRef<AbortController|null>(null),detailAbort=useRef<AbortController|null>(null);
  const listGuard=useRef(createGenerationGuard()),detailGuard=useRef(createGenerationGuard());

  useEffect(()=>{
    resetDetailForListRefresh(
      detailAbort.current,
      detailGuard.current,
      ()=>setSelectedId(null),
      ()=>setDetail(null),
    );
  },[filter,offset,listRetry]);

  useEffect(()=>{const controller=new AbortController();queueMicrotask(()=>{if(!controller.signal.aborted)setSummary({phase:"loading"});});void (async()=>{try{const response=await fetch("/api/jinyiwei/summary",{signal:controller.signal,cache:"no-store"});const body=await readJson(response);if(controller.signal.aborted)return;if(!response.ok||typeof body!=="object"||body===null||!("summary" in body)){setSummary({phase:"error",message:safeMessage(body,"总账暂时无法读取。")});return;}setSummary({phase:"ready",data:(body as {summary:JinyiweiSummary}).summary});}catch(error){if(!controller.signal.aborted)setSummary({phase:"error",message:error instanceof DOMException&&error.name==="AbortError"?"": "总账暂时无法读取。"});}})();return()=>controller.abort();},[summaryRetry]);

  useEffect(()=>{listAbort.current?.abort();const controller=new AbortController();const guard=listGuard.current;listAbort.current=controller;const generation=guard.next();queueMicrotask(()=>{if(!controller.signal.aborted&&guard.isCurrent(generation))setPage({phase:"loading"});});void (async()=>{try{const response=await fetch(`/api/jinyiwei/investigations?${buildInvestigationQuery(filter,LIMIT,offset)}`,{signal:controller.signal,cache:"no-store"});const body=await readJson(response);if(controller.signal.aborted||!guard.isCurrent(generation))return;if(!response.ok||typeof body!=="object"||body===null||!("page" in body)){setPage({phase:"error",message:safeMessage(body,"案卷目录暂时无法读取。")});return;}const next=(body as {page:JinyiweiPage}).page;setPage({phase:"ready",data:next});setSelectedId(current=>next.items.some(item=>item.investigationId===current)?current:(next.items[0]?.investigationId??null));}catch(error){if(!controller.signal.aborted&&guard.isCurrent(generation))setPage({phase:"error",message:error instanceof DOMException&&error.name==="AbortError"?"":"案卷目录暂时无法读取。"});}})();return()=>{controller.abort();guard.invalidate();};},[filter,offset,listRetry]);

  useEffect(()=>{detailAbort.current?.abort();const guard=detailGuard.current;guard.invalidate();if(selectedId===null){queueMicrotask(()=>setDetail(null));return;}const controller=new AbortController();detailAbort.current=controller;const generation=guard.next();queueMicrotask(()=>{if(!controller.signal.aborted&&guard.isCurrent(generation))setDetail({phase:"loading"});});void (async()=>{try{const response=await fetch(`/api/jinyiwei/investigations/${encodeURIComponent(selectedId)}`,{signal:controller.signal,cache:"no-store"});const body=await readJson(response);if(controller.signal.aborted||!guard.isCurrent(generation))return;if(!response.ok||typeof body!=="object"||body===null||!("investigation" in body)){setDetail({phase:"error",message:safeMessage(body,"案卷正文暂时无法读取。")});return;}setDetail({phase:"ready",data:(body as {investigation:JinyiweiDetail}).investigation});}catch(error){if(!controller.signal.aborted&&guard.isCurrent(generation))setDetail({phase:"error",message:error instanceof DOMException&&error.name==="AbortError"?"":"案卷正文暂时无法读取。"});}})();return()=>{controller.abort();guard.invalidate();};},[selectedId,detailRetry]);

  useEffect(()=>()=>{listAbort.current?.abort();detailAbort.current?.abort();listGuard.current.invalidate();detailGuard.current.invalidate();},[]);
  const pageInfo=page.phase==="ready"?getPageAvailability(offset,LIMIT,page.data.total,page.data.items.length):null;

  return <main className="jw-shell">
    <header className="jw-masthead"><div><p className="jw-kicker">中央证据稽核 · 司级调查留痕</p><h1>锦衣卫调查台账</h1><p className="jw-deck">查阅司级 Agent 因事实缺口发起的调查、证据出处与采用结果。</p></div><div className="jw-seal" aria-label="本页面只读"><span>只读</span><strong>案牍</strong></div></header>
    <section className="jw-summary" aria-labelledby="summary-title"><h2 id="summary-title">总账</h2>{summary.phase==="loading"?<p className="jw-muted">正在核对总账……</p>:summary.phase==="error"?<ErrorState message={summary.message} retry={()=>setSummaryRetry(v=>v+1)}/>:<dl><Metric label="调查" value={summary.data.totalInvestigations}/><Metric label="已解决" value={summary.data.resolvedCount}/><Metric label="部分" value={summary.data.partialCount}/><Metric label="受阻" value={summary.data.blockedCount}/><Metric label="不可用" value={summary.data.unavailableCount}/><Metric label="证据" value={summary.data.distinctEvidenceCount}/><Metric label="待挂接" value={summary.data.pendingAdoptionCount}/><Metric label="已挂接" value={summary.data.confirmedAdoptionCount}/></dl>}</section>
    <nav className="jw-filters" aria-label="调查状态筛选">{FILTERS.map(item=><button key={item.value} className={filter===item.value?"is-active":""} aria-pressed={filter===item.value} onClick={()=>{setFilter(item.value);setOffset(0);}}>{item.label}</button>)}</nav>
    <div className="jw-workbench">
      <section className="jw-index" aria-labelledby="index-title"><div className="jw-section-head"><div><p>卷宗目录</p><h2 id="index-title">调查案卷</h2></div>{page.phase==="ready"&&<span>{page.data.total} 卷</span>}</div>
        {page.phase==="loading"?<LoadingRows/>:page.phase==="error"?<ErrorState message={page.message} retry={()=>setListRetry(v=>v+1)}/>:page.data.items.length===0?<div className="jw-empty"><strong>暂无调查案卷</strong><p>只有司级 Agent 在办理中提出事实缺口时，案卷才会出现在这里。本台账不发起采集。</p></div>:<ol className="jw-dossiers">{page.data.items.map((item,index)=><Dossier key={item.investigationId} item={item} order={offset+index+1} selected={selectedId===item.investigationId} select={()=>setSelectedId(item.investigationId)}/>)}</ol>}
        {pageInfo&&<div className="jw-pagination"><button disabled={!pageInfo.canPrevious} onClick={()=>setOffset(pageInfo.previousOffset)}>上一页</button><span>{offset+1}—{Math.min(offset+(page.phase==="ready"?page.data.items.length:0),page.phase==="ready"?page.data.total:0)}</span><button disabled={!pageInfo.canNext} onClick={()=>setOffset(v=>v+LIMIT)}>下一页</button></div>}
      </section>
      <section className="jw-case" aria-labelledby="case-title">{selectedId===null?<div className="jw-empty jw-case-empty"><strong>尚未选定案卷</strong><p>从左侧目录选择一卷，查看证据链与限制。</p></div>:detail?.phase==="loading"?<div className="jw-case-loading"><p>正在拆封案卷……</p></div>:detail?.phase==="error"?<ErrorState message={detail.message} retry={()=>setDetailRetry(v=>v+1)}/>:detail?.phase==="ready"?<CaseFile detail={detail.data}/>:null}</section>
    </div>
  </main>;
}

function Metric({label,value}:{label:string;value:number}){return <div><dt>{label}</dt><dd>{value}</dd></div>}
function ErrorState({message,retry}:{message:string;retry:()=>void}){return <div className="jw-error" role="alert"><strong>读取中断</strong><p>{message}</p><button onClick={retry}>重新读取</button></div>}
function LoadingRows(){return <div className="jw-loading" aria-label="正在读取案卷"><i/><i/><i/></div>}
function Dossier({item,order,selected,select}:{item:JinyiweiListItem;order:number;selected:boolean;select:()=>void}){const status=statusPresentation(item.status);return <li><button className={selected?"is-selected":""} onClick={select}><span className="jw-folio">卷 {String(order).padStart(3,"0")}</span><strong>{item.question}</strong><span className={`jw-badge is-${item.status.toLowerCase()}`}><b aria-hidden>{status.symbol}</b>{status.label}</span><small>{item.requestingAgent} · {when(item.completedAt)}</small><span className="jw-counts">来源 {item.sourceAttemptCount}　证据 {item.evidenceCount}　回奏 {item.linkedReplyCount}</span></button></li>}
function EvidenceCard({item,historical=false}:{item:JinyiweiEvidence;historical?:boolean}){const quality=qualityPresentation(item.quality);return <article className="jw-evidence" key={item.evidenceId}><div className="jw-evidence-top"><span className={`jw-quality is-${item.quality.toLowerCase()}`}><b aria-hidden>{quality.symbol}</b>{quality.label}</span><span>{historical?"历史证据":item.stance==="SUPPORTS"?"↑ 支持":"↓ 反证"}</span><span>置信 {formatConfidence(item.confidence)}</span></div><p className="jw-value">{valueText(item.value)}{item.unit?` ${item.unit}`:""}</p><blockquote>{item.excerpt}</blockquote><dl><div><dt>发布者</dt><dd>{item.publisher}</dd></div><div><dt>来源类型</dt><dd>{item.sourceType==="MCP"?"批准的只读 MCP":item.sourceType}</dd></div><div><dt>资料时点</dt><dd>{when(item.asOf)}</dd></div><div><dt>采集时间</dt><dd>{when(item.retrievedAt)}</dd></div><div><dt>出处</dt><dd><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看原始出处</a></dd></div>{item.accessUrl&&<div><dt>访问溯源</dt><dd><a href={item.accessUrl} target="_blank" rel="noreferrer">查看访问地址</a></dd></div>}</dl>{item.accessMetadata&&<details><summary>访问元数据</summary><pre>{valueText(item.accessMetadata)}</pre></details>}</article>}

function CaseFile({detail}:{detail:JinyiweiDetail}){const status=statusPresentation(detail.status);return <article>
  <header className="jw-case-head"><div><p>案号 {detail.investigationId}</p><h2 id="case-title">{detail.request.question}</h2><span className={`jw-badge is-${detail.status.toLowerCase()}`}><b aria-hidden>{status.symbol}</b>{status.label}</span></div><dl><div><dt>请调司</dt><dd>{detail.request.requestingAgent}</dd></div><div><dt>调查期</dt><dd>{when(detail.investigationStartedAt)} — {when(detail.investigationCompletedAt)}</dd></div><div><dt>缓存</dt><dd>{detail.cache.hit?"命中旧卷":"本次新查"}{detail.cache.expiresAt?` · 有效至 ${when(detail.cache.expiresAt)}`:""}</dd></div></dl></header>
  <section className="jw-context"><h3>决策语境</h3><p>{detail.request.decisionContext}</p><p className="jw-utility">时效要求：{detail.request.freshness.maxAgeSeconds?`${detail.request.freshness.maxAgeSeconds} 秒内`:"未指定最大时长"}{detail.request.freshness.notBefore?`；不早于 ${when(detail.request.freshness.notBefore)}`:""}</p></section>
  <section><h3>所需事实</h3><ul className="jw-facts">{detail.request.requiredFacts.map(fact=><li key={fact.key}><code>{fact.key}</code><span>{fact.description}</span><small>{fact.category} · {fact.dataScope} · {fact.subject}{fact.jurisdiction?` · ${fact.jurisdiction}`:""} · {fact.expectedUnit??"单位未指定"} · {fact.expectedShape??"结构未指定"}</small></li>)}</ul></section>
  <section><div className="jw-spine-title"><div><p>按调查发生顺序</p><h3>证据脊线</h3></div><span>{Object.values(detail.evidenceByFact).flat().length} 条证据</span></div>
    {Object.values(detail.evidenceByFact).every(items=>items.length===0)&&<p className="jw-zero">本卷尚未取得任何可展示证据；以下仅保留调查尝试与不可推断边界。</p>}
    <ol className="jw-spine">{detail.sourceAttempts.map((attempt,index)=><li key={`${attempt.sourceName}-${index}`} className={`attempt is-${attempt.status.toLowerCase()}`}><span className="jw-node" aria-hidden>{attempt.status==="SUCCEEDED"?"✓":attempt.status==="BLOCKED"?"!":attempt.status==="FAILED"?"×":"—"}</span><div><p><strong>{attempt.sourceName}</strong><span>{attempt.sourceType}</span></p><small>{when(attempt.startedAt)} — {when(attempt.completedAt)}</small><p>查询事实：{attempt.factsAttempted.join("、")||"无"}</p>{attempt.callAudits.length>0&&<ul>{attempt.callAudits.map((audit,auditIndex)=><li key={`${audit.serverId}-${audit.toolName}-${auditIndex}`}><strong>{audit.toolName}</strong> · {audit.serverId} · {audit.durationMs}ms · {audit.responseBytes??0} bytes · {audit.mappingOutcome}{audit.cacheHit?" · 缓存命中":""}{audit.error?` · ${audit.error}`:""}</li>)}</ul>}{attempt.error&&<p className="jw-limit">限制：{attempt.error}</p>}</div></li>)}
      {Object.entries(detail.evidenceByFact).map(([factKey,evidence])=><li className="evidence-group" key={factKey}><span className="jw-node" aria-hidden>§</span><div><h4>{factKey}</h4>{evidence.length===0?<p className="jw-zero">该事实尚无可展示证据。</p>:evidence.map(item=><EvidenceCard key={item.evidenceId} item={item}/>)}</div></li>)}</ol>
    {Object.values(detail.historicalEvidenceByFact).some(items=>items.length>0)&&<div><h3>历史证据</h3>{Object.entries(detail.historicalEvidenceByFact).map(([factKey,items])=><div key={factKey}><h4>{factKey}</h4>{items.map(item=><EvidenceCard key={item.evidenceId} item={item} historical/>)}</div>)}</div>}
  </section>
  <section className="jw-limitations"><h3>冲突与边界</h3>{detail.conflicts.length===0&&detail.unresolvedFacts.length===0&&detail.doNotInfer.length===0?<p>未登记冲突或推断限制。</p>:<><ul>{detail.conflicts.map(c=><li key={`${c.factKey}-${c.evidenceIds.join()}`}><strong>冲突 · {c.factKey}</strong>：{c.summary}（{c.evidenceIds.join("、")}）</li>)}{detail.unresolvedFacts.map(f=><li key={f}><strong>未解决</strong>：{f}</li>)}{detail.doNotInfer.map(limit=><li key={limit}><strong>不可推断</strong>：{limit}</li>)}</ul></>}</section>
  <section className="jw-adoptions"><h3>回奏挂接</h3>{detail.adoptions.length===0?<p>尚无回奏采用这卷证据。</p>:<ul>{detail.adoptions.map(a=><li key={`${a.evidenceId}-${a.replyId}`}><span className={`jw-adoption is-${a.status.toLowerCase()}`} aria-hidden>{a.status==="CONFIRMED"?"●":"○"}</span><strong>{a.replyId}</strong><span>{a.status==="CONFIRMED"?"已确认挂接":"待确认挂接"}</span><small>证据 {a.evidenceId} · {when(a.updatedAt)}</small></li>)}</ul>}</section>
 </article>}
