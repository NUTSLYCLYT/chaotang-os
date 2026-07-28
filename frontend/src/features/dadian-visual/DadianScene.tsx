"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { DadianOverview } from "../../lib/backendClient";
import { CourtCapabilityButton } from "../court-visuals/CourtCapabilityButton";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import { createDadianViewModel } from "./dadianViewModel";
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
      href: string;
      x: number;
      y: number;
    }
  | {
      id: string;
      label: string;
      post: string;
      kind: "unavailable";
      tone: HotspotTone;
      href: string;
      x: number;
      y: number;
    };

const DEV_HOTSPOTS: readonly DevHotspot[] = [
  { id: "gongbu", label: "工部", post: "营造 · 修缮 · 基建", kind: "department", department: "工部", tone: "green", href: "/liubu/gongbu", x: 23.4, y: 44.5 },
  { id: "hubu", label: "户部", post: "财政 · 度支 · 资源", kind: "department", department: "户部", tone: "amber", href: "/liubu/finance", x: 29.4, y: 35.3 },
  { id: "libu-personnel", label: "吏部", post: "考绩 · 任免 · 文档", kind: "department", department: "吏部", tone: "green", href: "/liubu/personnel", x: 34.1, y: 29.7 },
  { id: "libu", label: "礼部", post: "礼仪 · 公文 · 对外", kind: "department", department: "礼部", tone: "green", href: "/liubu/market", x: 41.7, y: 31.4 },
  { id: "prime", label: "丞相", post: "总揽 · 会辅 · 裁断", kind: "unavailable", tone: "amber", href: "/study", x: 50.7, y: 37.0 },
  { id: "xingbu", label: "刑部", post: "律令 · 刑名 · 审断", kind: "department", department: "刑部", tone: "violet", href: "/liubu/legal", x: 60.2, y: 31.4 },
  { id: "bingbu", label: "兵部", post: "戍卫 · 情势 · 边务", kind: "department", department: "兵部", tone: "green", href: "/liubu/ops", x: 72.4, y: 35.2 },
  { id: "jinyiwei", label: "锦衣卫", post: "情报 · 侦缉 · 暗访", kind: "unavailable", tone: "blue", href: "/jinyiwei", x: 67.5, y: 29.3 },
  { id: "shiguan", label: "史馆", post: "史料 · 起居注 · 典藏", kind: "unavailable", tone: "blue", href: "/shiguan", x: 79.1, y: 44.4 },
] as const;

const TONE_COLORS: Record<HotspotTone, string> = {
  green: "#38d99a",
  amber: "#d8b76a",
  blue: "#57b7ff",
  violet: "#9b6cf6",
};

export interface DadianSceneProps {
  overview: DadianOverview | null;
  error: string | null;
  onRetry(): void;
}

export function DadianScene({
  overview,
  error,
  onRetry,
}: DadianSceneProps) {
  const view = createDadianViewModel({ overview, error });
  const router = useRouter();

  return (
    <ImmersiveCourtShell
      currentLabel="大殿"
      currentPath="/dadian"
      backgroundImage="/assets/dadian/hall-stage-tang.webp"
      fullBleedContent
      showQuickDockHandle={false}
      scene="dadian"
    >
      <div className={styles.scene}>
        <header className={styles.hero}>
          <div className={styles.titleRow}>
            <CloudFlourish mirrored />
            <h1>大殿</h1>
            <CloudFlourish />
          </div>
          <span className={styles.heroRule} aria-hidden="true" />
        </header>

        {view.state === "error" ? (
          <section
            className={`${styles.stateCard} ${styles.errorCard}`}
            data-dadian-state="error"
            role="alert"
          >
            <span className={styles.stateSeal} aria-hidden="true">!</span>
            <div>
              <h2>回奏暂未呈上</h2>
              <p>{view.blockingError}</p>
            </div>
            <button className={styles.retryButton} type="button" onClick={onRetry}>
              重试读取
            </button>
          </section>
        ) : view.state === "loading" ? (
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
        ) : view.overview !== null ? (
          <section
            className={styles.dashboard}
            data-dadian-state={view.state}
          >
            {view.nonBlockingError ? (
              <div
                className={styles.errorBanner}
                data-dadian-error="nonblocking"
                role="alert"
              >
                <span>{view.nonBlockingError} 当前继续展示上次成功读取的数据。</span>
                <button className={styles.retryButton} type="button" onClick={onRetry}>
                  重试读取
                </button>
              </div>
            ) : null}
            <aside className={styles.focusCard}>
              <div className={styles.panelHeading}>
                <span aria-hidden="true">♛</span>
                <div>
                  <p>丞相 · 今日要务</p>
                  <small>御前要务</small>
                </div>
              </div>
              <p className={styles.focusText}>{view.overview.todayFocus}</p>
              <div className={styles.focusMetrics}>
                <p>
                  <span>已归档回奏</span>
                  <strong>{view.overview.replyCount}</strong>
                </p>
                <p>
                  <span>待复盘</span>
                  <strong>{view.overview.pendingReviewCount}</strong>
                </p>
              </div>
              <CourtCapabilityButton
                capability="enabled"
                explanation="前往上书房拟定并下达旨意。"
                onClick={() => router.push("/study")}
              >
                殿前发令
              </CourtCapabilityButton>
            </aside>

            <div className={styles.courtMap}>
              <div className={styles.hotspots} aria-label="大殿百官席位">
                {DEV_HOTSPOTS.map((hotspot) => (
                  <MinisterHotspot key={hotspot.id} hotspot={hotspot} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </ImmersiveCourtShell>
  );
}

function MinisterHotspot({
  hotspot,
}: {
  hotspot: DevHotspot;
}) {
  const router = useRouter();
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
  const tooltipId = `dadian-hotspot-${hotspot.id}-tooltip`;
  const statusColor = TONE_COLORS[hotspot.tone];

  return (
    <button
      className={styles.hotspot}
      data-tooltip-edge={edge}
      data-tooltip-open={tipOpen || undefined}
      type="button"
      aria-describedby={tooltipId}
      onClick={() => router.push(hotspot.href)}
      style={{
        "--hotspot-x": `${hotspot.x}%`,
        "--hotspot-y": `${hotspot.y}%`,
        "--status-color": statusColor,
      } as CSSProperties}
      onMouseEnter={openTip}
      onMouseLeave={closeTip}
      onFocus={openTip}
      onBlur={closeTip}
    >
      <i aria-hidden="true" />
      <strong>{hotspot.label}</strong>
      <span>
        <b aria-hidden="true" />
        席位展示
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
