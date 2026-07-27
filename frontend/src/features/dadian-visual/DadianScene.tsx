"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DadianOverview } from "../../lib/backendClient";
import { CourtCapabilityButton } from "../court-visuals/CourtCapabilityButton";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import styles from "./DadianScene.module.css";

type HotspotTone = "green" | "amber" | "blue" | "violet";

type DevHotspot =
  | {
      id: string;
      label: string;
      post: string;
      kind: "department";
      department: string;
      tone: HotspotTone;
      x: number;
      y: number;
    }
  | {
      id: string;
      label: string;
      post: string;
      kind: "unavailable";
      tone: HotspotTone;
      x: number;
      y: number;
    };

const DEV_HOTSPOTS: readonly DevHotspot[] = [
  { id: "gongbu", label: "工部", post: "营造 · 修缮 · 基建", kind: "department", department: "工部", tone: "green", x: 21.7, y: 38.6 },
  { id: "hubu", label: "户部", post: "财政 · 度支 · 资源", kind: "department", department: "户部", tone: "amber", x: 30, y: 30.4 },
  { id: "shibu", label: "史部", post: "考绩 · 任免 · 文档", kind: "department", department: "吏部", tone: "green", x: 34.1, y: 23.6 },
  { id: "libu", label: "礼部", post: "礼仪 · 公文 · 对外", kind: "department", department: "礼部", tone: "green", x: 41.6, y: 26.5 },
  { id: "prime", label: "丞相", post: "总揽 · 会辅 · 裁断", kind: "unavailable", tone: "amber", x: 50.7, y: 28.6 },
  { id: "bingbu", label: "兵部", post: "戍卫 · 情势 · 边务", kind: "department", department: "兵部", tone: "green", x: 60.7, y: 26.5 },
  { id: "jinyiwei", label: "锦衣卫", post: "情报 · 侦缉 · 暗访", kind: "unavailable", tone: "blue", x: 68.3, y: 23.6 },
  { id: "qintianjian", label: "钦天监", post: "天象 · 历法 · 预测", kind: "unavailable", tone: "violet", x: 73.1, y: 30.4 },
  { id: "shiguan", label: "史馆", post: "史料 · 起居注 · 典藏", kind: "unavailable", tone: "blue", x: 79.5, y: 38.6 },
] as const;

const TONE_COLORS: Record<HotspotTone, string> = {
  green: "#38d99a",
  amber: "#d8b76a",
  blue: "#57b7ff",
  violet: "#9b6cf6",
};

export interface DadianSceneProps {
  department: string;
  overview: DadianOverview | null;
  error: string | null;
  onDepartmentChange(department: string): void;
  onRetry(): void;
}

export function DadianScene({
  department,
  overview,
  error,
  onDepartmentChange,
  onRetry,
}: DadianSceneProps) {
  const isEmpty = overview?.replyCount === 0;

  return (
    <ImmersiveCourtShell
      currentLabel="大殿"
      currentPath="/dadian"
      backgroundImage="/assets/dadian/hall-stage-tang.webp"
      scene="dadian"
    >
      <div className={styles.scene}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            Chaotang OS
          </p>
          <div className={styles.titleRow}>
            <CloudFlourish mirrored />
            <h1>大殿</h1>
            <CloudFlourish />
          </div>
          <p className={styles.subtitle}>企业 AI 指挥中枢 · 万务一统</p>
          <span className={styles.heroRule} aria-hidden="true" />
        </header>

        {error ? (
          <section
            className={`${styles.stateCard} ${styles.errorCard}`}
            data-dadian-state="error"
            role="alert"
          >
            <span className={styles.stateSeal} aria-hidden="true">!</span>
            <div>
              <h2>回奏暂未呈上</h2>
              <p>{error}</p>
            </div>
            <button className={styles.retryButton} type="button" onClick={onRetry}>
              重试读取
            </button>
          </section>
        ) : overview === null ? (
          <section
            className={styles.stateCard}
            data-dadian-state="loading"
            aria-live="polite"
          >
            <span className={styles.loadingSeal} aria-hidden="true" />
            <div>
              <h2>正在读取真实回奏</h2>
              <p>大殿正在向同源史馆概览核对当前数据…</p>
            </div>
          </section>
        ) : (
          <section
            className={styles.dashboard}
            data-dadian-state={isEmpty ? "empty" : "ready"}
          >
            <aside className={styles.focusCard}>
              <div className={styles.panelHeading}>
                <span aria-hidden="true">♛</span>
                <div>
                  <p>丞相 · 今日要务</p>
                  <small>御前要务</small>
                </div>
              </div>
              <p className={styles.focusText}>{overview.todayFocus}</p>
              <div className={styles.focusMetrics}>
                <p>
                  <span>已归档回奏</span>
                  <strong>{overview.replyCount}</strong>
                </p>
                <p>
                  <span>待复盘</span>
                  <strong>{overview.pendingReviewCount}</strong>
                </p>
              </div>
              <CourtCapabilityButton
                capability="unavailable"
                explanation="当前大殿仅提供真实回奏概览；下旨请前往上书房，本页不会代为发起写操作。"
              >
                殿前发令
              </CourtCapabilityButton>
            </aside>

            <div className={styles.courtMap}>
              <div className={styles.filterBar}>
                <label htmlFor="dadian-department">参与部门</label>
                <select
                  id="dadian-department"
                  value={department}
                  onChange={(event) => onDepartmentChange(event.target.value)}
                >
                  <option value="">全部真实回奏</option>
                  {overview.departmentCounts.map((item) => (
                    <option key={item.department} value={item.department}>
                      {item.department}（{item.count}）
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.hotspots} aria-label="大殿百官席位与真实部门回奏分布">
                {DEV_HOTSPOTS.map((hotspot) => {
                  const count =
                    hotspot.kind === "department"
                      ? overview.departmentCounts.find(
                          (item) => item.department === hotspot.department,
                        )?.count ?? 0
                      : null;
                  return (
                    <MinisterHotspot
                      key={hotspot.id}
                      hotspot={hotspot}
                      count={count}
                      selected={
                        hotspot.kind === "department" &&
                        department === hotspot.department
                      }
                      onSelect={() => {
                        if (hotspot.kind === "department") {
                          onDepartmentChange(
                            department === hotspot.department ? "" : hotspot.department,
                          );
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <section className={styles.replyDock} aria-labelledby="recent-replies-heading">
              <div className={styles.dockHeading}>
                <div>
                  <p>Imperial Archive · 御前回奏栏</p>
                  <h2 id="recent-replies-heading">最新真实回奏</h2>
                </div>
                <span>{department || "全部部门"}</span>
              </div>

              {overview.recentReplies.length === 0 ? (
                <div className={styles.emptyState} aria-live="polite">
                  <strong>暂无真实回奏</strong>
                  <p>
                    {department
                      ? `当前筛选“${department}”没有可展示的已归档回奏。`
                      : "史馆尚未返回可展示的已归档回奏。"}
                  </p>
                </div>
              ) : (
                <ul className={styles.replyList}>
                  {overview.recentReplies.map((reply) => (
                    <li key={reply.id}>
                      <div className={styles.replyTitle}>
                        <strong>{reply.title}</strong>
                        <time dateTime={reply.replyTime}>{reply.replyTime}</time>
                      </div>
                      <p>{reply.replyConclusion}</p>
                      <small>
                        {reply.respondent}
                        <span aria-hidden="true"> · </span>
                        {reply.participatingDepartments.join("、")}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>
        )}
      </div>
    </ImmersiveCourtShell>
  );
}

function MinisterHotspot({
  hotspot,
  count,
  selected,
  onSelect,
}: {
  hotspot: DevHotspot;
  count: number | null;
  selected: boolean;
  onSelect(): void;
}) {
  const [tipOpen, setTipOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const openTip = useCallback(() => {
    clearCloseTimer();
    setTipOpen(true);
  }, [clearCloseTimer]);
  const closeTip = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setTipOpen(false), 500);
  }, [clearCloseTimer]);
  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const edge = hotspot.x < 25 ? "left" : hotspot.x > 68 ? "right" : "center";
  const status = count === null ? "暂无数据" : `${count} 条回奏`;
  const tooltipId = `dadian-hotspot-${hotspot.id}-tooltip`;
  const statusColor = TONE_COLORS[hotspot.tone];

  return (
    <button
      className={styles.hotspot}
      data-selected={selected || undefined}
      data-tooltip-edge={edge}
      data-tooltip-open={tipOpen || undefined}
      type="button"
      aria-pressed={hotspot.kind === "department" ? selected : undefined}
      aria-disabled={hotspot.kind === "unavailable" || undefined}
      aria-describedby={tooltipId}
      style={{
        "--hotspot-x": `${hotspot.x}%`,
        "--hotspot-y": `${hotspot.y}%`,
        "--status-color": statusColor,
      } as CSSProperties}
      onClick={onSelect}
      onMouseEnter={openTip}
      onMouseLeave={closeTip}
      onFocus={openTip}
      onBlur={closeTip}
    >
      <i aria-hidden="true" />
      <strong>{hotspot.label}</strong>
      <span>
        <b aria-hidden="true" />
        {status}
      </span>
      <span
        className={styles.hotspotTooltip}
        id={tooltipId}
        role="tooltip"
        onMouseEnter={openTip}
        onMouseLeave={closeTip}
      >
        <strong>{hotspot.label}</strong>
        <span>{hotspot.post}</span>
        {hotspot.kind === "department" ? (
          <>
            <span>真实归档回奏 {count} 条</span>
            <em>
              {hotspot.label === "史部"
                ? "沿用 dev 席位名；当前数据来自吏部"
                : selected
                  ? "再次选择可清除筛选"
                  : "选择以筛选真实回奏"}
            </em>
          </>
        ) : (
          <>
            <span>当前接口未提供该席位指标</span>
            <em>仅还原 dev 视觉席位，不展示推测数值</em>
          </>
        )}
      </span>
    </button>
  );
}

function CloudFlourish({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={mirrored ? styles.cloudMirrored : styles.cloud}
      viewBox="0 0 120 40"
      fill="none"
    >
      <path d="M2 20h54" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path
        d="M56 20c6 0 8-6 14-6s8 6 14 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M98 14c4 0 6 3 6 6s-2 6-6 6-5-3-3-6c1.4-2.2 4-2 4-2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
