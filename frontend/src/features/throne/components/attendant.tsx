'use client';

/**
 * 陛下视图 · 钦天监导师
 *
 * 悬浮在右下角的陪伴者 — 用白话解释当前页面发生了什么，
 * 建议陛下下一步做什么。支持收起、展开、换一句。
 *
 * 这是整个陛下视图的"灵魂"，所有陌生概念都通过它向用户翻译。
 */

import { useState, useEffect, useRef } from 'react';
import { X, ChevronUp, Sparkles, HelpCircle } from 'lucide-react';

export interface AttendantLine {
  /** unique id so we can cycle without repeating */
  id: string;
  /** 钦天监说的话 */
  text: string;
  /** optional cta */
  action?: { label: string; onClick: () => void };
  /** 'guide' | 'explain' | 'celebrate' */
  tone?: 'guide' | 'explain' | 'celebrate';
}

export interface AttendantProps {
  lines: AttendantLine[];
  /** When the lines change (page change), cycle to first */
  keyProp?: string;
  /** Whether to open automatically on first show (default: true) */
  autoOpen?: boolean;
}

const ATTENDANT_NAME = '钦天监 · 先知导师';

export function Attendant({ lines, keyProp, autoOpen = true }: AttendantProps) {
  const [open, setOpen] = useState(autoOpen);
  const [cursor, setCursor] = useState(0);
  const mountedRef = useRef(false);

  // Reset cursor on new page
  useEffect(() => {
    setCursor(0);
    if (mountedRef.current) {
      setOpen(true);
    }
    mountedRef.current = true;
  }, [keyProp]);

  // ? key toggles
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?' || e.key === '？') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (lines.length === 0) return null;
  const line = lines[cursor % lines.length];
  if (!line) return null;

  const hasNext = lines.length > 1;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 right-6 z-40 print:hidden"
    >
      {open ? (
        <div className="pointer-events-auto relative w-[320px] animate-[fadeInUp_.4s_ease-out]">
          {/* Card */}
          <div
            className="overflow-hidden rounded-xl border backdrop-blur-xl"
            style={{
              borderColor: 'rgba(240, 198, 106, 0.35)',
              background:
                'linear-gradient(135deg, rgba(20, 16, 8, 0.92), rgba(10, 8, 4, 0.96))',
              boxShadow:
                '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(240,198,106,0.08), inset 0 1px 0 rgba(240,198,106,0.12)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#F0C66A]/15 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[14px]"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 30%, #F0C66A, #8A6A2A)',
                    boxShadow: '0 0 10px rgba(240,198,106,0.35)',
                  }}
                >
                  ✦
                </div>
                <div>
                  <div className="text-[10px] font-semibold tracking-wider text-[#F0C66A]">
                    {ATTENDANT_NAME}
                  </div>
                  <div className="text-[8px] text-[#6A7299]">观星导师 · 按 ? 呼出</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-[#6A7299] transition-colors hover:bg-white/5 hover:text-[#EAEEFB]"
                aria-label="收起"
              >
                <X size={12} />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3">
              <p className="text-[12px] leading-relaxed text-[#EAEEFB]">
                <span className="text-[#F0C66A]">钦天监 </span>
                {line.text}
              </p>

              {/* Action row */}
              {(line.action || hasNext) && (
                <div className="mt-3 flex items-center gap-2">
                  {line.action && (
                    <button
                      type="button"
                      onClick={line.action.onClick}
                      className="flex items-center gap-1 rounded-md border border-[#F0C66A]/40 bg-[#F0C66A]/10 px-2.5 py-1 text-[10px] font-medium text-[#F0C66A] transition-colors hover:bg-[#F0C66A]/15"
                    >
                      <Sparkles size={10} />
                      {line.action.label}
                    </button>
                  )}
                  {hasNext && (
                    <button
                      type="button"
                      onClick={() => setCursor((c) => (c + 1) % lines.length)}
                      className="ml-auto rounded-md border border-white/10 px-2 py-1 text-[10px] text-[#9AA3C4] transition-colors hover:bg-white/5 hover:text-[#EAEEFB]"
                    >
                      再说一句
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer — pagination dots */}
            {hasNext && (
              <div className="flex items-center justify-center gap-1 border-t border-[#F0C66A]/10 bg-black/20 py-1.5">
                {lines.map((_, i) => (
                  <span
                    key={i}
                    className="h-1 w-1 rounded-full transition-colors"
                    style={{
                      background:
                        i === cursor % lines.length ? '#F0C66A' : 'rgba(240,198,106,0.25)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pointer tail */}
          <div
            className="pointer-events-none absolute -right-1 bottom-6 h-3 w-3 rotate-45"
            style={{
              background: 'rgba(10, 8, 4, 0.96)',
              borderRight: '1px solid rgba(240,198,106,0.35)',
              borderTop: '1px solid rgba(240,198,106,0.35)',
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border text-[20px] transition-all hover:scale-105"
          style={{
            borderColor: 'rgba(240,198,106,0.4)',
            background:
              'radial-gradient(circle at 30% 30%, rgba(240,198,106,0.35), rgba(10,8,4,0.92))',
            boxShadow:
              '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(240,198,106,0.2)',
          }}
          aria-label="召唤钦天监"
          title="按 ? 召唤钦天监"
        >
          ✦
        </button>
      )}

      {/* Help hint badge */}
      {!open && (
        <div
          className="pointer-events-none absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
          style={{
            background: '#F0C66A',
            color: '#04060E',
          }}
          aria-hidden
        >
          <HelpCircle size={11} strokeWidth={3} />
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
