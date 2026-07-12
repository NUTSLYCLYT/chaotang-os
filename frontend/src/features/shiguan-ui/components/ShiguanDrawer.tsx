"use client";

import { useEffect } from "react";

interface ShiguanDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function ShiguanDrawer({ open, onClose }: ShiguanDrawerProps) {
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
        aria-label="史馆说明"
        aria-modal="true"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-gold-300/25 bg-[#080c18]/95 backdrop-blur-xl shadow-[0_0_60px_-10px_rgba(0,0,0,0.8)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="gold-hairline absolute inset-x-0 top-0" />

        <header className="flex items-center justify-between border-b border-gold-300/15 px-5 py-4">
          <div>
            <h2 className="font-serif text-[18px] font-semibold text-gold-gradient">
              史馆说明
            </h2>
            <p className="mt-0.5 text-[12px] text-slatey-400">
              真实归档与史册生成边界
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
          <Section title="当前能力边界">
            <div className="rounded-lg border border-gold-300/12 bg-gold-300/[0.04] px-3.5 py-3 text-[12.5px] leading-relaxed text-jade-100/85">
              史册生成功能尚未接入真实归档写入。当前页面只展示后端返回的真实案卷、决策和知识记录；没有真实记录时保持空态，不生成示例事件或模拟复盘。
            </div>
          </Section>
          <Section title="怎样形成真实案卷">
            <p className="text-[12.5px] leading-relaxed text-jade-100/85">
              在上书房完成裁决、由军机处完成会审，并通过人工确认与归档门后，记录才会进入史馆。未完成补证或仍在执行中的事项不会提前归档。
            </p>
          </Section>
        </div>

        <footer className="border-t border-gold-300/15 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gold-300/35 bg-gold-300/[0.06] py-3 font-serif text-[15px] font-semibold tracking-wide text-gold-100 transition-colors hover:bg-gold-300/[0.12]"
          >
            知道了
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
