"use client";

import { ReactNode } from "react";

type Variant = "gold" | "ghost";

interface ActionButtonProps {
  children: ReactNode;
  glyph?: string;
  variant?: Variant;
  onClick?: () => void;
  className?: string;
  title?: string;
}

const base =
  "group inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60";

const variants: Record<Variant, string> = {
  // 帝王金主按钮：克制的金，hover 轻微发光
  gold:
    "border border-gold-300/55 bg-gradient-to-b from-gold-200/20 to-gold-500/10 text-gold-100 hover:from-gold-200/30 hover:to-gold-500/15 hover:border-gold-200/70 hover:shadow-gold-glow",
  // 幽玻璃次按钮
  ghost:
    "border border-gold-300/15 bg-white/[0.03] text-jade-100/90 hover:border-gold-300/40 hover:bg-white/[0.06] hover:text-gold-100 hover:shadow-[0_0_18px_-6px_rgba(220,180,86,0.4)]",
};

export default function ActionButton({
  children,
  glyph,
  variant = "ghost",
  onClick,
  className = "",
  title,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {glyph && (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-serif text-[12px] ${
            variant === "gold"
              ? "bg-gold-300/25 text-gold-50"
              : "bg-gold-300/12 text-gold-200/90 group-hover:bg-gold-300/20"
          }`}
        >
          {glyph}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}
