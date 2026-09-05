"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { fetchSceneMissions, fetchSceneRun, updateSceneMission } from "./client";
import { buildBoardPath, createSceneBoardController, parseBoardPath, visibleMissions, type BoardFilter, type BoardNavigation } from "./sceneBoardController";
import { buildV4Presentation, riskText, stageText, type V4Presentation } from "./sceneBoardV4Presentation";
import styles from "./SceneBoardV4.module.css";

const browserPathListeners = new Set<() => void>();
function notifyBrowserPath() {
  for (const notify of browserPathListeners) notify();
}
function subscribeBrowserPath(notify: () => void) {
  browserPathListeners.add(notify);
  window.addEventListener("hashchange", notify);
  window.addEventListener("popstate", notify);
  return () => {
    browserPathListeners.delete(notify);
    window.removeEventListener("hashchange", notify);
    window.removeEventListener("popstate", notify);
  };
}
function readBrowserPath() {
  return window.location.pathname + window.location.search
    + (window.location.href.includes("#") ? "#" : "");
}
const serverBrowserPath = () => null;

export function SceneBoard({ initialPath = "/junjichu/scene-board" }: { initialPath?: string }) {
  const router = useRouter();
  const [controller] = useState(() => createSceneBoardController({
    list: signal => fetchSceneMissions({}, signal),
    detail: (id, signal) => fetchSceneRun(id, signal),
    patch: updateSceneMission,
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const browserPath = useSyncExternalStore(subscribeBrowserPath, readBrowserPath, serverBrowserPath);
  useEffect(notifyBrowserPath, [initialPath]);
  const listHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (browserPath === null) return;
    void controller.start(browserPath);
    return () => controller.dispose();
  }, [controller, browserPath]);
  const requested = parseBoardPath(browserPath);
  const current = !!requested && !!state.navigation && buildBoardPath(requested) === buildBoardPath(state.navigation);
  const nav = state.navigation;
  const missions = current ? state.missions : [];
  const selected = current ? state.selected : null;
  const visible = visibleMissions(missions, nav?.filter ?? "all");
  const presentation = current && nav?.panel === "detail" && state.detail === "ready"
    ? buildV4Presentation(selected, state.run) : null;
  const excluded = !!selected && !visible.some(m => m.missionId === selected.missionId);
  useEffect(() => {
    if (current && nav?.panel === "list") listHeading.current?.focus();
  }, [current, nav?.panel]);
  function go(next: BoardNavigation) {
    router.push(buildBoardPath(next), {scroll: false});
  }
  const back = () => go({mission: nav?.mission ?? null, filter: nav?.filter ?? "all", panel: "list"});
  return (
    <main className={styles.workspace} data-panel={nav?.panel ?? "list"}>
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.seal} aria-hidden="true">军</span><div>
          <p className={styles.eyebrow}>COURTOS · MILITARY OFFICE</p><h1>军机处 · 任务与下一步</h1>
        </div></div>
        <button className={styles.button} type="button" onClick={() => router.push("/dadian")}>返回大殿</button>
      </header>
      <div className={styles.intro}>
        <p>一案一卷，先看结果，再解阻塞。看板阶段不等于业务验收、报价批准或史馆归档。</p>
        <span className={styles.edition}>V4 · 案卷工作台</span>
      </div>
      {browserPath !== null && !requested ? <p className={styles.notice} role="alert">任务链接无效，请从军机处任务列表重新进入。</p> : null}
      {state.authExpired ? <p className={styles.notice} role="alert">会话已失效，旧任务已隐藏。请重新登录。 <button className={styles.button} type="button" onClick={() => router.push("/login?next=" + encodeURIComponent(initialPath))}>重新登录</button></p> : null}
      <section className={styles.grid}>
        <aside className={styles.panel + " " + styles.caseList}>
          <div className={styles.panelHeading}><h2 ref={listHeading} tabIndex={-1}>项目案卷</h2><span className={styles.eyebrow}>CASE FILES</span></div>
          <p className={styles.count} aria-live="polite">已加载任务 {missions.length} 项 · 当前筛选 {visible.length} 项</p>
          <div className={styles.filters} aria-label="任务筛选">
            {([["all", "全部"], ["awaiting", "待补齐"], ["high", "高风险"], ["done", "看板已标记完成"]] as [BoardFilter, string][]).map(([filter, label]) => (
              <button key={filter} type="button" aria-pressed={nav?.filter === filter}
                onClick={() => go({mission: nav?.mission ?? null, filter, panel: "list"})}>{label}</button>
            ))}
          </div>
          <button className={styles.button} type="button" disabled={state.list === "loading" || !requested} onClick={() => void controller.refresh()}>重新读取列表</button>
          {!current || state.list === "loading" ? <p className={styles.notice} role="status">正在读取任务…</p> : null}
          {current && state.list === "error" ? <p className={styles.notice} role="alert">任务列表暂不可读。可重新读取，不会重新提交任务。</p> : null}
          {current && state.list === "unavailable" && !state.authExpired ? <p className={styles.notice} role="alert">任务暂不可查看，旧详情已隐藏。请重新读取列表。</p> : null}
          {current && state.list === "ready" && !visible.length ? <p className={styles.notice}>暂无符合当前筛选的任务。</p> : null}
          <div className={styles.missionList}>
            {visible.map(m => (
              <button key={m.missionId} type="button" className={styles.mission} data-risk={m.riskGrade}
                aria-pressed={nav?.mission === m.missionId} onClick={() => go({mission: m.missionId, filter: nav?.filter ?? "all", panel: "detail"})}>
                <span className={styles.missionTop}>{m.packName}<span>看板：{stageText(m.stage)}</span></span>
                <strong>{m.title}</strong>
                <small>风险：{riskText(m.riskGrade)} · 提示日期：{m.dueAt}</small>
                <small>下一步：{m.nextMilestone}</small>
              </button>
            ))}
          </div>
        </aside>
        {presentation ? <TaskColumns key={presentation.identityKey} model={presentation} back={back}
          excluded={excluded} showAll={() => nav && go({...nav, filter: "all"})}
          enterScene={() => router.push("/scene-pack/" + encodeURIComponent(presentation.packSlug))}
          mark={stage => void controller.mark(stage)} busy={state.busy || state.write === "unconfirmed"} />
          : <section className={styles.paper} aria-busy={state.detail === "loading"}>
            <button className={styles.button} type="button" onClick={back}>返回任务列表</button>
            <div className={styles.empty}><span className={styles.emptyMark} aria-hidden="true">卷</span><h2>任务详情</h2>
              {nav?.panel !== "detail" ? <p className={styles.summary}>选择一项任务，查看现有结果与下一步。</p>
                : !current || state.list === "loading" || state.detail === "loading" ? <p role="status">正在读取所选任务…</p>
                : state.detail === "error" ? <p role="alert">任务详情读取失败，当前没有可显示的详情。请重新读取列表；不会重新提交任务。</p>
                : <p role="alert">该任务当前不可查看，请重新读取列表。不会替换为其他任务。</p>}
            </div>
          </section>}
      </section>
      <div aria-live="polite">
        {state.write === "pending" ? <p className={styles.notice}>阶段更新请求正在处理，请勿重复操作。</p> : null}
        {state.write === "unconfirmed" ? <p className={styles.notice} role="alert">阶段更新结果未确认，没有自动重发。请重新读取列表后核对。</p> : null}
        {state.write === "saved" ? <p className={styles.notice}>看板阶段已记录；不代表业务验收完成。</p> : null}
      </div>
      <footer className={styles.footer}><p>同一任务 · 同一结果 · 不另建事实源</p><p>正式下旨与成果确认仍由上书房办理；此处仅查看和跟进。</p></footer>
    </main>
  );
}

function TaskColumns({model, back, excluded, showAll, enterScene, mark, busy}: {
  model: V4Presentation; back: () => void; excluded: boolean; showAll: () => void;
  enterScene: () => void; mark: (stage: "awaiting_input" | "blocked" | "done") => void; busy: boolean;
}) {
  // A new validated identity mounts a fresh view; no state is retained across tasks.
  const [view, setView] = useState<"overview" | "results">("overview");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <>
    <article className={styles.paper}>
      <div className={styles.paperTop}><p className={styles.eyebrow}>{model.packName} · CURRENT RECORD</p>
        <button className={styles.button} type="button" onClick={back}>返回任务列表</button></div>
      <h2 ref={heading} tabIndex={-1}>{model.title}</h2>
      <p className={styles.reality}>{model.realityLabel}</p>
      {excluded ? <p className={styles.notice} role="status">所选任务不在当前筛选中；选择仍保留。 <button className={styles.button} type="button" onClick={showAll}>显示全部任务</button></p> : null}
      <div className={styles.stateRow}><div><span>生成状态</span><strong>{model.statusLabel}</strong></div>
        <div><span>看板阶段 · 手动记录</span><strong>{model.stageLabel}</strong></div></div>
      <div className={styles.views} role="group" aria-label="案卷视图">
        <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")}>任务概览</button>
        <button type="button" aria-pressed={view === "results"} onClick={() => setView("results")}>成果与证据</button>
      </div>
      {view === "overview" ? <section aria-label="任务概览内容">
        <span className={styles.risk} data-risk={model.risk}>风险：{model.riskLabel}</span>
        <p className={styles.verdict}>{model.verdict}</p><p className={styles.summary}>{model.summary}</p>
        <div className={styles.actionRow}><button className={styles.button} type="button" onClick={enterScene}>进入对应场景</button>
          <button className={styles.button} type="button" onClick={() => setView("results")}>查看现有证据</button></div>
        <div className={styles.unavailable}><p>真实协作依赖与排期尚未接入，不由手动阶段推算进度。</p>
          <div className={styles.actionRow}><button className={styles.button} disabled type="button">协作全景 · 未接入</button><button className={styles.button} disabled type="button">排期 · 未接入</button></div></div>
      </section> : <section aria-label="成果与证据内容">
        <h3>现有结果摘要</h3><p className={styles.summary}>{model.summary}</p>
        <h3>现有证据来源</h3><p className={styles.subtle}>以下为结果附带的引用信息，不等于独立核验或正式验收。</p>
        {model.evidenceRefs.length ? model.evidenceRefs.map((ref, i) => <div className={styles.evidence} key={i}>
          <p>{ref.claim}</p><small>来源：{ref.sourceLabel} · {ref.sourceType} · {ref.reliability}</small><small>记录时间：{ref.capturedAt || "未提供"}</small>
        </div>) : <p className={styles.notice}>当前结果未提供证据引用。</p>}
        <div className={styles.unavailable}><p>当前接口没有可授权下载的文件、成果版本和验收记录；不生成假文件或批准状态。</p>
          <div className={styles.actionRow}><button className={styles.button} disabled type="button">下载成果包 · 未接入</button><button className={styles.button} disabled type="button">版本对比 · 未接入</button></div></div>
      </section>}
      <details className={styles.technical}><summary>技术标识</summary><p>任务：{model.missionId}</p><p>结果：{model.runId}</p></details>
    </article>
    <aside className={styles.panel + " " + styles.decision} aria-label="阻塞与下一步">
      <div className={styles.panelHeading}><h2>需要你关注</h2><span className={styles.eyebrow}>NEXT STEP</span></div>
      <p className={styles.subtle}>只展示当前结果已记录的事项，不推断审批是否完成。</p>
      <h3>缺失与阻塞</h3>
      {model.missingItems.length ? <ul>{model.missingItems.map((item, i) => <li key={i}>{item}</li>)}</ul>
        : <p className={styles.subtle}>当前结果未列出缺失项，不代表已验收。</p>}
      <h3>下一步</h3>
      {model.nextActions.length ? <ol>{model.nextActions.map((action, i) => <li key={i}>{action.title}
        <small>{action.priority} · {action.ownerDept} · {action.dueHint}</small></li>)}</ol>
        : <p className={styles.subtle}>当前结果未提供下一步建议。</p>}
      <a className={styles.button} href="/study">前往上书房</a>
      <p className={styles.subtle}>普通导航，不表示已定位或批准当前任务对应的正式旨意。</p>
      <details className={styles.manual}><summary>手动标记看板阶段</summary>
        <p>仅更新看板记录，不改变风险等级，不批准报价或触发归档。</p>
        {(["awaiting_input", "blocked", "done"] as const).map(stage =>
          <button key={stage} className={styles.button} type="button" disabled={busy} onClick={() => mark(stage)}>标记看板阶段：{stageText(stage)}</button>)}
      </details>
    </aside>
  </>;
}
