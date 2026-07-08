"use client";

/**
 * DomainCard — 庄园六部浮空卡片
 *
 * 双区点击(Task #11):
 *   - 标志区(card-mark):独立 button/a,点击导航到该部页面(markHref)。
 *     吏部等无 markHref 时标志区不可点(aria-disabled)。
 *   - 卡片主体其余区域:onClick 选中并通知父组件展示蜂群面板(不导航)。
 *
 * HTML 合法性:<button> 内不嵌 <button>。
 *   外层为 div[role=button] 处理主体点击,标志区独立 button + stopPropagation。
 */

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export interface CardMetric {
  label: string;
  value: string;
  delta?: boolean;
}

export interface DomainCardProps {
  keyName?: string;
  title: string;
  mark: ReactNode;
  color: string;
  metrics: CardMetric[];
  box: { left: number; top: number; width: number; height: number };
  /** 主体区域点击回调(选中 + 打开蜂群面板,不导航) */
  onClick?: () => void;
  /** 标志区点击导航目标 URL。undefined = 无目标,标志区不可点击 */
  markHref?: string;
  selected?: boolean;
  enterDelayMs?: number;
  /**
   * 是否为「真」部门(有升级版决策办公厅,数据真/判断真)。
   * true → 金光常驻 + 「真」徽;false → 灰度暗置 + 「待建」(诚实 vitrine,真假一眼分)。
   * 由六部大厅按办公厅注册表(getDepartmentOffice)注入,非硬编码(铁律2 SSOT)。
   */
  live?: boolean;
  dimWhenInactive?: boolean;
}

const GOLD = "#F0C66A";

/** 稳定宽度的数值列，tnum + 右对齐，避免数值抖动 */
function MetricRow({ label, value, delta, pulse }: CardMetric & { pulse: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] leading-[1.35]">
      <span className="text-jade-dim shrink-0">{label}</span>
      <span
        className="tnum font-medium tabular-nums text-right min-w-[48px]"
        style={{
          color: pulse
            ? "var(--color-gold-bright)"
            : delta
              ? "var(--color-celadon)"
              : "var(--color-jade)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function DomainCard({
  keyName,
  title,
  mark,
  color,
  metrics,
  box,
  onClick,
  markHref,
  selected = false,
  enterDelayMs = 0,
  live = false,
  dimWhenInactive = true,
}: DomainCardProps) {
  const [pulseIndex, setPulseIndex] = useState(-1);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const deltaIndices = metrics
        .map((m, i) => (m.delta ? i : -1))
        .filter((i) => i >= 0);
      if (deltaIndices.length > 0) {
        const pick = deltaIndices[Math.floor(Math.random() * deltaIndices.length)];
        setPulseIndex(pick);
        setTimeout(() => setPulseIndex(-1), 1200);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [metrics]);

  // 键盘支持: Enter/Space 触发主体 onClick
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  const style = {
    position: "absolute",
    ...box,
    zIndex: selected ? 18 : 15,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    overflow: "hidden",
    textAlign: "left",
    cursor: "pointer",
    "--card-glow": `${color}99`,
    animationDelay: `${enterDelayMs}ms`,
    // 骨架部门暗置：重灰度 + 重降透明，与金光真部门一眼炸开（诚实 vitrine）。
    ...(!live && !selected && dimWhenInactive ? { filter: "grayscale(0.92)", opacity: 0.38 } : {}),
    ...(selected
      ? {
          borderColor: color,
          boxShadow: `inset 0 1px 0 rgba(235,203,123,0.25), 0 0 0 1px ${color}, 0 0 38px -6px ${color}cc, 0 22px 50px -18px rgba(0,0,0,0.95)`,
        }
      : live
        ? {
            // 真部门金光常驻（即使未选中也发光，标明"这是能用的"）。
            borderColor: `${GOLD}55`,
            boxShadow: `inset 0 1px 0 ${GOLD}33, 0 0 0 1px ${GOLD}66, 0 0 30px -8px ${GOLD}aa, 0 16px 40px -20px rgba(0,0,0,0.9)`,
          }
        : {}),
  } as unknown as CSSProperties;

  return (
    /* 外层 div 承担主体点击(选中 + 蜂群面板),不导航 */
    <div
      ref={bodyRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-manor-key={keyName}
      aria-label={`查看 ${title} 蜂群状态`}
      aria-pressed={selected}
      className={`card anim-pop ${selected ? "is-selected" : ""}`}
      style={style}
    >
      <span className="card-stamp" aria-hidden="true">览</span>

      {/* 真/骨架 徽：真部门金「真」徽，骨架灰「待建」，诚实标真假 */}
      <span
        className="absolute right-2 top-2 rounded-full px-1.5 py-[1px] text-[9px] font-semibold leading-none"
        style={
          live
            ? { color: GOLD, border: `1px solid ${GOLD}66`, background: `${GOLD}1a` }
            : { color: "#8a8470", border: "1px solid #8a847055", background: "#8a847012" }
        }
      >
        {live ? "真 · LIVE" : "待建"}
      </span>

      {/* 头部 — 标志区独立可点击导航 */}
      <div className="flex items-center gap-[8px]">
        {markHref ? (
          /* 有目标页面:独立 button 做跳转,stopPropagation 避免触发主体 onClick */
          <Link
            href={markHref}
            aria-label={`前往 ${title} 部门页面`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="card-mark grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] text-[16px] transition-transform hover:scale-110 focus:outline-none focus-visible:ring-1"
            style={{
              color,
              border: `1px solid ${color}9a`,
              background: `linear-gradient(160deg, ${color}30 0%, ${color}12 60%, transparent 100%)`,
              boxShadow: `inset 0 1px 0 ${color}44, 0 0 12px -2px ${color}77`,
              // ring color via inline style fallback
              outlineOffset: 2,
            }}
            title={`前往 ${title}`}
          >
            {mark}
          </Link>
        ) : (
          /* 无目标页面(吏部等):不可交互，纯展示 */
          <span
            aria-hidden="true"
            className="card-mark grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] text-[16px]"
            style={{
              color,
              border: `1px solid ${color}9a`,
              background: `linear-gradient(160deg, ${color}30 0%, ${color}12 60%, transparent 100%)`,
              boxShadow: `inset 0 1px 0 ${color}44, 0 0 12px -2px ${color}77`,
              opacity: 0.72,
            }}
          >
            {mark}
          </span>
        )}
        <span className="font-serif text-[14px] font-semibold tracking-[0.05em] text-jade leading-tight">
          {title}
        </span>
      </div>

      {/* 指标行：真部门显真值；骨架部门一律打码「待接入」——金光对了，数字也不许撒谎(诚实) */}
      <div className="mt-[8px] flex flex-col gap-[3px]">
        {metrics.map((m, i) =>
          live ? (
            <MetricRow key={m.label} {...m} pulse={pulseIndex === i} />
          ) : (
            <div key={m.label} className="flex items-baseline justify-between text-[11px] leading-[1.35]">
              <span className="text-jade-dim shrink-0">{m.label}</span>
              <span className="tnum text-right min-w-[48px] tabular-nums" style={{ color: "#6f6a58" }}>
                待接入
              </span>
            </div>
          ),
        )}
      </div>

      {/* 底部分隔线 */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 6,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
          opacity: selected ? 1 : 0.45,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
