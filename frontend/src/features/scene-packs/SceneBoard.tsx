"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchSceneMissions, fetchSceneRun, updateSceneMission } from "./client";
import type { SceneMission, SceneRun } from "./types";
import styles from "./scenePacks.module.css";

type Filter = "all" | "awaiting" | "high" | "done";

export function SceneBoard() {
  const router = useRouter();
  const [missions, setMissions] = useState<SceneMission[]>([]);
  const [selected, setSelected] = useState<SceneMission | null>(null);
  const [run, setRun] = useState<SceneRun | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const items = await fetchSceneMissions();
      setMissions(items);
      setSelected((current) => current ?? items[0] ?? null);
    } catch {
      setError("Scene Pack 任务暂不可读，请稍后重试。");
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  useEffect(() => {
    if (!selected) {
      queueMicrotask(() => setRun(null));
      return;
    }
    let cancelled = false;
    void fetchSceneRun(selected.runId)
      .then((sceneRun) => {
        if (!cancelled) setRun(sceneRun);
      })
      .catch(() => {
        if (!cancelled) setRun(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const visible = missions.filter((mission) => {
    if (filter === "awaiting") return mission.stage === "awaiting_input" || mission.stage === "blocked";
    if (filter === "high") return mission.riskGrade === "high";
    if (filter === "done") return mission.stage === "done";
    return true;
  });

  async function mark(stage: SceneMission["stage"]) {
    if (!selected) return;
    const updated = await updateSceneMission(selected.missionId, { stage });
    setMissions((current) => current.map((item) => item.missionId === updated.missionId ? updated : item));
    setSelected(updated);
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <div>
          <p>MILITARY OFFICE · SCENE PACK BOARD</p>
          <h1>军机处 · 场景任务看板</h1>
        </div>
        <button className={styles.sceneButton} type="button" onClick={() => router.push("/dadian")}>返回大殿</button>
      </header>

      <section className={styles.boardGrid}>
        <aside className={styles.panel}>
          <h2>Scene Pack 任务分组</h2>
          <div className={styles.filterBar}>
            {[
              ["all", "全部"],
              ["awaiting", "待补齐"],
              ["high", "高风险"],
              ["done", "已完成"],
            ].map(([value, label]) => (
              <button key={value} type="button" data-active={filter === value} onClick={() => setFilter(value as Filter)}>
                {label}
              </button>
            ))}
          </div>
          {error ? <p role="alert">{error}</p> : null}
          {visible.length ? visible.map((mission) => (
            <button
              key={mission.missionId}
              className={styles.missionCard}
              data-risk={mission.riskGrade}
              type="button"
              onClick={() => setSelected(mission)}
            >
              <span>{mission.packName} · {stageText(mission.stage)}</span>
              <strong>{mission.title}</strong>
              <small>风险：{riskText(mission.riskGrade)} · 下次复查：{mission.dueAt}</small>
              <small>下一步：{mission.nextMilestone}</small>
            </button>
          )) : <p>暂无符合条件的场景任务。</p>}
        </aside>

        <section className={styles.panel}>
          <h2>任务详情</h2>
          {selected && run ? (
            <>
              <div className={styles.verdict}>
                <span>{selected.packName}</span>
                <strong>{run.verdictText}</strong>
                <i className={styles.riskBadge} data-risk={run.riskGrade}>风险：{riskText(run.riskGrade)}</i>
              </div>
              <p>{run.summaryForUser}</p>
              <h3>缺失项</h3>
              <ul className={styles.list}>
                {(run.missingItems.length ? run.missingItems : ["暂无阻断缺失项"]).map((item) => <li key={item}>{item}</li>)}
              </ul>
              <h3>下一步</h3>
              <ul className={styles.list}>
                {run.nextActions.map((action) => (
                  <li key={`${action.ownerDept}-${action.title}`}>
                    {action.priority} · {action.ownerDept} · {action.title}（{action.dueHint}）
                  </li>
                ))}
              </ul>
              <h3>证据来源</h3>
              {run.evidenceRefs.map((ref) => (
                <div className={styles.evidence} key={`${ref.claim}-${ref.sourceLabel}`}>
                  {ref.claim}<br />
                  来源：{ref.sourceLabel} · {ref.sourceType} · {ref.reliability}
                </div>
              ))}
              <div className={styles.fixedBar}>
                <button className={styles.sceneButton} type="button" onClick={() => void mark("awaiting_input")}>标记待补资料</button>
                <button className={styles.sceneButton} type="button" onClick={() => void mark("blocked")}>标记高风险阻断</button>
                <button className={styles.sceneButton} type="button" onClick={() => void mark("done")}>标记已完成</button>
                <button className={styles.sceneButton} type="button" onClick={() => router.push(`/scene-pack/${selected.packSlug}`)}>进入场景</button>
              </div>
            </>
          ) : (
            <p>点击左侧任务卡，查看裁决、风险、缺失项、下一步和证据来源。</p>
          )}
        </section>
      </section>
    </main>
  );
}

function riskText(risk: string): string {
  return risk === "low" ? "低" : risk === "medium" ? "中" : "高";
}

function stageText(stage: string): string {
  return {
    todo: "待办",
    in_progress: "推进中",
    awaiting_input: "待补资料",
    blocked: "阻断",
    done: "已完成",
  }[stage] ?? stage;
}
