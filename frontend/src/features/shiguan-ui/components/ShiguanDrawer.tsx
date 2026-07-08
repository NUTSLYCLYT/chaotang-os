"use client";

import { useEffect, useState } from "react";
import {
  chronicleTypes,
  type ChronicleType,
  drawerEvents,
  drawerDecisions,
  drawerAISummary,
  drawerKnowledge,
} from "@/features/shiguan-ui/lib/shiguan-data";

interface ShiguanDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function ShiguanDrawer({ open, onClose }: ShiguanDrawerProps) {
  const [type, setType] = useState<ChronicleType>("日史");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* 抽屉 */}
      <aside
        role="dialog"
        aria-label="生成史册"
        aria-modal="true"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-gold-300/25 bg-[#080c18]/95 backdrop-blur-xl shadow-[0_0_60px_-10px_rgba(0,0,0,0.8)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="gold-hairline absolute inset-x-0 top-0" />

        <header className="flex items-center justify-between border-b border-gold-300/15 px-5 py-4">
          <div>
            <h2 className="font-serif text-[18px] font-semibold text-gold-gradient">
              生成史册
            </h2>
            <p className="mt-0.5 text-[12px] text-slatey-400">
              将今日朝堂记忆凝练成册
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold-300/20 text-slatey-300 transition-colors hover:border-gold-300/50 hover:text-gold-100"
          >
            ✕
          </button>
        </header>

        <div className="thin-scroll flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* 史册类型 */}
          <Section title="史册类型">
            <div className="flex flex-wrap gap-2">
              {chronicleTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={
                    type === t
                      ? "rounded-lg border border-gold-300/55 bg-gold-300/12 px-3.5 py-1.5 text-[13px] text-gold-100"
                      : "rounded-lg border border-gold-300/15 px-3.5 py-1.5 text-[13px] text-slatey-300 transition-colors hover:border-gold-300/40 hover:text-gold-100"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </Section>

          {/* 今日重要事件 */}
          <Section title="今日重要事件">
            <ul className="space-y-2">
              {drawerEvents.map((e, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 rounded-lg border border-gold-300/10 bg-white/[0.03] px-3 py-2 text-[12.5px] text-jade-100/90"
                >
                  <span className="mt-0.5 text-gold-300">◆</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* 关键决策 */}
          <Section title="关键决策">
            <ul className="space-y-2">
              {drawerDecisions.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gold-300/10 bg-white/[0.03] px-3 py-2"
                >
                  <span className="text-[12.5px] text-jade-100/90">{d.title}</span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10.5px] leading-none ${
                      d.status === "执行中"
                        ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"
                        : "border-slatey-400/30 bg-slatey-400/10 text-slatey-300"
                    }`}
                  >
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* AI 复盘摘要 */}
          <Section title="AI 复盘摘要">
            <p className="rounded-lg border border-gold-300/12 bg-gold-300/[0.04] px-3.5 py-3 text-[12.5px] leading-relaxed text-jade-100/85">
              {drawerAISummary}
            </p>
          </Section>

          {/* 可入库知识 */}
          <Section title="可入库知识">
            <ul className="space-y-1.5">
              {drawerKnowledge.map((k, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-[12.5px] text-jade-100/85"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />
                  {k}
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <footer className="border-t border-gold-300/15 px-5 py-4">
          <button
            type="button"
            className="w-full rounded-xl border border-gold-300/55 bg-gradient-to-b from-gold-200/25 to-gold-500/12 py-3 font-serif text-[15px] font-semibold tracking-wide text-gold-100 transition-all duration-200 hover:from-gold-200/35 hover:border-gold-200/70 hover:shadow-gold-glow"
          >
            生成奏折并归档「{type}」
          </button>
        </footer>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-3 w-[3px] rounded-full bg-gradient-to-b from-gold-200 to-gold-500" />
        <h3 className="font-serif text-[14px] font-semibold text-jade-50">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
