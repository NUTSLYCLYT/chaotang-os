"use client";

import { useEffect, useMemo, useState } from "react";

import type { CapabilityRegistryProjection } from "../../lib/backendClient";
import { buildCapabilityRegistryViewModel, capabilityBadge } from "./capabilityRegistryViewModel";
import styles from "./CapabilityRegistry.module.css";

type ApiState =
  | { status: "loading" }
  | { status: "ready"; registry: CapabilityRegistryProjection }
  | { status: "error"; message: string };

export function CapabilityRegistryClient() {
  const [state, setState] = useState<ApiState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetch("/api/capabilities", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok || body?.status !== "ok") {
          setState({ status: "error", message: body?.message ?? "能力总账暂时不可用" });
          return;
        }
        setState({ status: "ready", registry: body.registry });
      })
      .catch(() => {
        if (active) setState({ status: "error", message: "无法连接能力总账" });
      });
    return () => { active = false; };
  }, []);

  const view = useMemo(() => state.status === "ready" ? buildCapabilityRegistryViewModel(state.registry) : null, [state]);

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>CapabilityRegistry V1 · Readonly Projection</p>
        <h1>朝堂能力总账</h1>
        <p>把分散的 Skill、Agent、蜂群、Workflow、MCP 和外部工具收束成一个能看清、能考绩、能组阁的总账。</p>
        <div className={styles.actions} aria-label="能力总账入口">
          <a href="#hanlin">翰林院荐才榜</a>
          <a href="#libu">吏部能力考绩</a>
          <a href="#honglusi">鸿胪寺外部候选</a>
          <a href="/junjichu">军机处组阁</a>
        </div>
      </section>

      {state.status === "loading" ? <p className={styles.state}>正在读取只读能力总账……</p> : null}
      {state.status === "error" ? <p className={styles.state}>{state.message}</p> : null}

      {view ? (
        <>
          <section className={styles.tiles} aria-label="能力总览">
            {view.tiles.map((tile) => (
              <article className={styles.tile} key={tile.label}>
                <span>{tile.label}</span>
                <strong>{tile.value}</strong>
                <p>{tile.hint}</p>
              </article>
            ))}
          </section>

          <section className={styles.panel} id="hanlin">
            <div className={styles.panelHead}>
              <p className={styles.eyebrow}>翰林院</p>
              <h2>荐才榜：先找能复用、低风险、已有证据的能力</h2>
            </div>
            <div className={styles.cardGrid}>
              {view.recommendedForPaidScenarios.slice(0, 8).map((item) => (
                <article className={styles.card} key={item.card.id}>
                  <span className={styles.badge}>{capabilityBadge(item)}</span>
                  <h3>{item.card.name}</h3>
                  <p>{item.card.bestUseCase}</p>
                  <footer>{item.card.recommendedHome} · {item.card.type}</footer>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} id="libu">
            <div className={styles.panelHead}>
              <p className={styles.eyebrow}>吏部</p>
              <h2>能力考绩：晋升、合并、降级都看真实结果</h2>
            </div>
            <div className={styles.groupList}>
              {view.departmentGroups.slice(0, 10).map((group) => (
                <article className={styles.group} key={group.home}>
                  <div>
                    <h3>{group.title}</h3>
                    <p>{group.description}</p>
                  </div>
                  <strong>{group.items.length}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} id="honglusi">
            <div className={styles.panelHead}>
              <p className={styles.eyebrow}>鸿胪寺</p>
              <h2>外部候选：默认不授权，先审查再试用</h2>
            </div>
            <div className={styles.cardGrid}>
              {view.externalCandidates.slice(0, 6).map((item) => (
                <article className={styles.card} key={item.card.id}>
                  <span className={styles.badge}>{capabilityBadge(item)}</span>
                  <h3>{item.card.name}</h3>
                  <p>{item.externalReview?.allowedActions.join("、") ?? "待审查"}</p>
                  <footer>禁止：{item.externalReview?.forbiddenActions.slice(0, 2).join("、")}</footer>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
