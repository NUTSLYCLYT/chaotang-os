"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { fetchSceneMissions, fetchSceneRun, updateSceneMission } from "./client";
import { buildBoardPath, createSceneBoardController, parseBoardPath, visibleMissions, type BoardFilter, type BoardNavigation } from "./sceneBoardController";
import styles from "./scenePacks.module.css";

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
  // A fragment is not sent to the server, including a trailing bare '#'.
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
  // Next commits pushState without a native popstate/hashchange event.
  // Recheck the real URL after its server-provided route props are committed.
  useEffect(notifyBrowserPath, [initialPath]);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (browserPath === null) return;
    void controller.start(browserPath);
    return () => controller.dispose();
  }, [controller, browserPath]);
  const requested = parseBoardPath(browserPath);
  const current = !!requested && !!state.navigation && buildBoardPath(requested) === buildBoardPath(state.navigation);
  const nav = state.navigation;
  const selected = current ? state.selected : null;
  const run = current ? state.run : null;
  const missions = current ? state.missions : [];
  const visible = visibleMissions(missions, nav?.filter ?? "all");
  const excluded = !!selected && !visible.some(m => m.missionId === selected.missionId);
  useEffect(() => {
    if (!current) return;
    if (state.detail === "ready" && nav?.panel === "detail") detailHeading.current?.focus();
    else if (nav?.panel === "list") listHeading.current?.focus();
  }, [current, state.detail, nav?.panel, selected?.missionId]);
  function go(next: BoardNavigation) {
    const path = buildBoardPath(next);
    router.push(path, {scroll: false});
  }
  return (
    <main className={`${styles.workspace} ${styles.boardWorkspace}`} data-panel={nav?.panel ?? "list"}>
      <header className={styles.workspaceHeader}>
        <div><p>MILITARY OFFICE · TASK BOARD</p><h1>军机处 · 任务与下一步</h1></div>
        <button className={styles.sceneButton} type="button" onClick={() => router.push("/dadian")}>返回大殿</button>
      </header>
      <p>查看已有结果、补齐阻塞、跟进看板阶段。这里的阶段标记不等于业务验收、报价批准或史馆归档。</p>
      {browserPath !== null && !requested ? <p role="alert">任务链接无效，请从军机处任务列表重新进入。</p> : null}
      {state.authExpired ? <p role="alert">会话已失效，旧任务已隐藏。请重新登录。 <button type="button" onClick={() => router.push("/login?next=" + encodeURIComponent(initialPath))}>重新登录</button></p> : null}
      <section className={styles.boardGrid}>
        <aside className={`${styles.panel} ${styles.boardList}`}>
          <h2 ref={listHeading} tabIndex={-1}>任务列表</h2>
          <p aria-live="polite">已加载 {missions.length} 项 · 当前筛选 {visible.length} 项</p>
          <div className={styles.filterBar} aria-label="任务筛选">
            {([["all", "全部"], ["awaiting", "待补齐"], ["high", "高风险"], ["done", "看板已标记完成"]] as [BoardFilter, string][]).map(([filter, label]) => (
              <button key={filter} type="button" aria-pressed={nav?.filter === filter} data-active={nav?.filter === filter}
                onClick={() => go({mission: nav?.mission ?? null, filter, panel: "list"})}>{label}</button>
            ))}
          </div>
          <button type="button" className={styles.sceneButton} disabled={state.list === "loading" || !requested} onClick={() => void controller.refresh()}>重新读取列表</button>
          {!current || state.list === "loading" ? <p role="status">正在读取任务…</p> : null}
          {current && state.list === "error" ? <p role="alert">任务列表暂不可读。可重新读取，不会重新提交任务。</p> : null}
          {current && state.list === "unavailable" && !state.authExpired ? <p role="alert">任务暂不可查看，旧详情已隐藏。请重新读取列表。</p> : null}
          {current && state.list === "ready" && !visible.length ? <p>暂无符合当前筛选的任务。</p> : null}
          {visible.map(m => (
            <button key={m.missionId} type="button" className={styles.missionCard} data-risk={m.riskGrade}
              aria-pressed={nav?.mission === m.missionId} onClick={() => go({mission: m.missionId, filter: nav?.filter ?? "all", panel: "detail"})}>
              <span>{m.packName} · 看板：{stageText(m.stage)}</span><strong>{m.title}</strong>
              <small>风险：{riskText(m.riskGrade)} · 提示日期：{m.dueAt}</small><small>下一步：{m.nextMilestone}</small>
            </button>
          ))}
        </aside>
        <section className={`${styles.panel} ${styles.boardDetail}`} aria-busy={state.detail === "loading"}>
          <button className={styles.sceneButton} type="button" onClick={() => go({mission: nav?.mission ?? null, filter: nav?.filter ?? "all", panel: "list"})}>返回任务列表</button>
          <h2 ref={detailHeading} tabIndex={-1}>{selected && run && nav?.panel === "detail" ? selected.title : "任务详情"}</h2>
          {excluded ? <p role="status">所选任务不在当前筛选中；选择仍保留。 <button type="button" onClick={() => go({...nav!, filter: "all"})}>显示全部任务</button></p> : null}
          {nav?.panel !== "detail" ? <p>选择一项任务，查看现有结果与下一步。</p> : !current || state.list === "loading" || state.detail === "loading" ? <p role="status">正在读取所选任务…</p>
            : state.detail === "error" ? <p role="alert">任务详情读取失败，当前没有可显示的详情。请重新读取列表；不会重新提交任务。</p>
            : !selected || !run || state.detail !== "ready" ? <p role="alert">该任务当前不可查看，请重新读取列表。不会替换为其他任务。</p> : (
            <>
              <div className={styles.verdict}><span>{selected.packName}</span><strong>{run.verdictText}</strong>
                <i className={styles.riskBadge} data-risk={run.riskGrade}>风险：{riskText(run.riskGrade)}</i></div>
              <p>{run.demo ? "示例结果 · 不用于正式业务决策" : "非示例结果 · 不表示事实已独立核验"}</p>
              <p>生成状态：{runStatusText(run.status)} · 看板阶段：{stageText(selected.stage)}</p>
              <p>{run.summaryForUser}</p>
              <h3>缺失与阻塞</h3><ul className={styles.list}>{(run.missingItems.length ? run.missingItems : ["当前结果未列出缺失项，不代表已验收"]).map((item, i) => <li key={i}>{item}</li>)}</ul>
              <h3>下一步</h3><ul className={styles.list}>{run.nextActions.map((action, i) => <li key={i}>{action.priority} · {action.ownerDept} · {action.title}（{action.dueHint}）</li>)}</ul>
              <button className={styles.sceneButton} type="button" onClick={() => router.push("/scene-pack/" + encodeURIComponent(selected.packSlug))}>进入对应场景</button>
              <h3>现有证据来源</h3>{run.evidenceRefs.length ? run.evidenceRefs.map((ref, i) => <div className={styles.evidence} key={i}>{ref.claim}<br />来源：{ref.sourceLabel} · {ref.sourceType} · {ref.reliability}</div>) : <p>当前结果未提供证据引用。</p>}
              <details><summary>手动标记看板阶段</summary><p>仅更新看板记录，不改变风险等级，不批准报价或触发归档。</p>
                <div className={styles.boardActions}>{(["awaiting_input", "blocked", "done"] as const).map(stage =>
                  <button key={stage} className={styles.sceneButton} type="button" disabled={state.busy || state.write === "unconfirmed"} onClick={() => void controller.mark(stage)}>标记看板阶段：{stageText(stage)}</button>)}</div>
              </details>
              <details><summary>技术标识</summary><p>任务：{selected.missionId}</p><p>结果：{selected.runId}</p></details>
            </>
          )}
          <div aria-live="polite">
            {state.write === "pending" ? <p>阶段更新请求正在处理，请勿重复操作。</p> : null}
            {state.write === "unconfirmed" ? <p role="alert">阶段更新结果未确认，没有自动重发。请重新读取列表后核对。</p> : null}
            {state.write === "saved" ? <p>看板阶段已记录；不代表业务验收完成。</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
function riskText(risk: string) { return risk === "low" ? "低" : risk === "medium" ? "中" : "高"; }
function stageText(stage: string) {
  return ({todo: "待办", in_progress: "推进中", awaiting_input: "待补资料", blocked: "阻断", done: "已标记完成"} as Record<string, string>)[stage] ?? "未知";
}
function runStatusText(status: string) {
  return ({created: "已创建", running: "生成中", completed: "生成完成", blocked: "生成阻断", failed: "生成失败"} as Record<string, string>)[status] ?? "未知";
}
