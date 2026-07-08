"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Hotspot } from "@/features/dadian/lib/dadian";

const TONE_COLOR: Record<Hotspot["tone"], string> = {
  green: "#38D99A",
  amber: "#D8B76A",
  blue: "#57B7FF",
  violet: "#9B6CF6",
};

const TOOLTIP_CLOSE_DELAY_MS = 500;

export default function MinisterHotspot({ h }: { h: Hotspot }) {
  const [tipOpen, setTipOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const edge = h.cx < 20 ? "left" : h.cx > 68 ? "right" : "center";
  const statusColor = TONE_COLOR[h.tone];
  const tooltipPositionClass =
    edge === "left"
      ? "left-full top-1/2 ml-4 -translate-y-1/2"
      : edge === "right"
        ? "right-full top-1/2 mr-4 -translate-y-1/2"
        : "bottom-full left-1/2 mb-4 -translate-x-1/2";
  const tooltipMotionClass =
    edge === "left"
      ? tipOpen ? "translate-x-0" : "translate-x-1"
      : edge === "right"
        ? tipOpen ? "translate-x-0" : "-translate-x-1"
        : tipOpen ? "translate-y-0" : "translate-y-1";
  const arrowClass =
    edge === "left"
      ? "left-[-5px] top-1/2 -translate-y-1/2 rotate-45 border-b border-l"
      : edge === "right"
        ? "right-[-5px] top-1/2 -translate-y-1/2 rotate-45 border-r border-t"
        : "bottom-[-5px] left-1/2 -translate-x-1/2 rotate-45 border-b border-r";

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openTip = useCallback(() => {
    clearCloseTimer();
    setTipOpen(true);
  }, [clearCloseTimer]);

  const scheduleCloseTip = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setTipOpen(false);
      closeTimerRef.current = null;
    }, TOOLTIP_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  return (
    <Link
      href={h.href}
      data-hotspot
      aria-label={`进入${h.name}`}
      aria-describedby={`minister-tip-${h.id}`}
      onMouseEnter={openTip}
      onMouseLeave={scheduleCloseTip}
      onFocus={openTip}
      onBlur={scheduleCloseTip}
      className={`group absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center outline-none transition-[z-index] hover:z-50 focus-visible:z-50 ${tipOpen ? "z-50" : "z-20"}`}
      style={{
        left: `${h.cx}%`,
        top: `${h.cy}%`,
        width: "clamp(74px, 5.2vw, 98px)",
        height: "clamp(48px, 3.4vw, 60px)",
      }}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-[5px] rotate-45 border-b border-r border-[#F0C66A]/30 bg-[#101722]/95 shadow-[5px_5px_14px_rgba(0,0,0,0.3)]"
        style={{
          background:
            "linear-gradient(135deg, rgba(18,24,34,0.34), rgba(8,13,23,0.22))",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      />
      <span
        className="relative flex h-full w-full flex-col items-center justify-center rounded-[8px] border px-2 text-center shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_20px_rgba(240,198,106,0.04)] backdrop-blur-[10px] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_34px_rgba(0,0,0,0.34),0_0_20px_rgba(240,198,106,0.18),inset_0_1px_0_rgba(255,255,255,0.16),inset_0_0_20px_rgba(240,198,106,0.06)] group-focus-visible:-translate-y-0.5"
        style={{
          borderColor: "rgba(240,198,106,0.36)",
          background:
            "linear-gradient(180deg, rgba(18,24,34,0.42), rgba(8,13,23,0.30)), radial-gradient(circle at 50% 0%, rgba(255,233,184,0.12), transparent 62%)",
          color: "#F5E9C9",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <span aria-hidden className="absolute left-2 top-2 h-2 w-2 border-l border-t border-[#F0C66A]/28" />
        <span aria-hidden className="absolute right-2 top-2 h-2 w-2 border-r border-t border-[#F0C66A]/28" />
        <span aria-hidden className="absolute bottom-2 left-2 h-2 w-2 border-b border-l border-[#F0C66A]/22" />
        <span aria-hidden className="absolute bottom-2 right-2 h-2 w-2 border-b border-r border-[#F0C66A]/22" />
        <span aria-hidden className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/50 to-transparent" />
        <span className="relative text-[14px] font-semibold leading-none tracking-[0.14em] text-[#F5E9C9] drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
          {h.name}
        </span>
        <span className="relative mt-1.5 inline-flex items-center gap-1.5 text-[9.5px] font-medium leading-none tracking-[0.12em]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
            aria-hidden
          />
          <span style={{ color: statusColor }}>{h.status}</span>
        </span>
      </span>

      <span
        id={`minister-tip-${h.id}`}
        role="tooltip"
        onMouseEnter={openTip}
        onMouseLeave={scheduleCloseTip}
        className={`absolute z-50 w-[188px] rounded-[12px] border border-[#F0C66A]/38 px-3.5 py-3 text-left shadow-[0_20px_54px_rgba(0,0,0,0.52),0_0_28px_rgba(240,198,106,0.13)] backdrop-blur-xl transition duration-200 ease-out ${tipOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"} ${tooltipPositionClass} ${tooltipMotionClass}`}
        style={{
          background:
            "linear-gradient(180deg, rgba(18,22,31,0.92), rgba(7,12,22,0.82)), radial-gradient(circle at 18% 0%, rgba(240,198,106,0.16), transparent 44%)",
        }}
      >
        <span
          aria-hidden
          className={`absolute h-2.5 w-2.5 border-[#F0C66A]/40 bg-[#111827] ${arrowClass}`}
        />
        <span aria-hidden className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/65 to-transparent" />
        <span aria-hidden className="absolute left-2 top-2 h-2 w-2 border-l border-t border-[#F0C66A]/45" />
        <span aria-hidden className="absolute bottom-2 right-2 h-2 w-2 border-b border-r border-[#F0C66A]/45" />

        <span className="block text-[15px] font-semibold tracking-[0.16em] text-[#F5E9C9] drop-shadow-[0_1px_2px_rgba(0,0,0,0.72)]">
          {h.name}
        </span>
        <span className="mt-1.5 block text-[11px] leading-relaxed tracking-[0.08em] text-[#D8C08A]/90">
          {h.post}
        </span>
        <span className="mt-2.5 inline-flex items-center gap-1 rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/10 px-2 py-1 text-[10px] tracking-[0.12em] text-[#F0C66A]">
          进入官署
          <span aria-hidden>→</span>
        </span>
      </span>
    </Link>
  );
}
