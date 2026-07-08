'use client';

/**
 * 朝堂 OS · 通用 Mascot 原语
 *
 * 源自 features/throne/components/attendant.tsx，升级支持：
 * - persona 参数化（钦天监 / 赵无眠 / 白简 / 丞相 / 庄主）
 * - 放大版（420px 宽 · 80px 头像 + 身份副标 + 半身立绘区）
 * - 兼容旧 `AttendantLine` 数据结构
 *
 * 这是"一群人围着陛下做事"品牌系统的基础件。
 */

import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, HelpCircle } from 'lucide-react';
import type { MascotPersona } from '@/features/shared/lib/mascot-personas';

export interface MascotLine {
  id: string;
  text: string;
  action?: { label: string; onClick: () => void };
  tone?: 'guide' | 'explain' | 'celebrate';
}

export interface CourtMascotProps {
  persona: MascotPersona;
  lines: MascotLine[];
  /** 新页面进入时重置到第一句 */
  keyProp?: string;
  /** 首次是否自动展开 */
  autoOpen?: boolean;
  /** 放大版（推荐首页 / 主 mascot） */
  enlarged?: boolean;
  /** 右下定位偏移（支持多 mascot 不重叠） */
  offset?: { right: number; bottom: number };
}

export function CourtMascot({
  persona,
  lines,
  keyProp,
  autoOpen = true,
  enlarged = false,
  offset = { right: 24, bottom: 24 },
}: CourtMascotProps) {
  const [open, setOpen] = useState(autoOpen);
  const [cursor, setCursor] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    setCursor(0);
    if (mountedRef.current) setOpen(true);
    mountedRef.current = true;
  }, [keyProp]);

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
  const width = enlarged ? 460 : 320;
  const avatarSize = enlarged ? 88 : 48;
  const textSize = enlarged ? 15 : 12;
  const titleSize = enlarged ? 14 : 10;
  const subtitleSize = enlarged ? 11 : 8;
  const portraitEmojiSize = enlarged ? 42 : 18;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed z-40 print:hidden"
      style={{ right: offset.right, bottom: offset.bottom }}
    >
      {open ? (
        <div
          className="pointer-events-auto relative animate-[mascotIn_.4s_ease-out]"
          style={{ width }}
        >
          <div
            className="overflow-hidden rounded-2xl border backdrop-blur-xl"
            style={{
              borderColor: `${persona.accent}59`,
              background: 'linear-gradient(135deg, rgba(20, 16, 8, 0.92), rgba(10, 8, 4, 0.96))',
              boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${persona.accent}14, inset 0 1px 0 ${persona.accent}1F`,
            }}
          >
            {/* Header with portrait */}
            <div
              className="flex items-start gap-3 border-b px-4 py-3"
              style={{ borderColor: `${persona.accent}26` }}
            >
              <div
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  height: avatarSize,
                  width: avatarSize,
                  fontSize: portraitEmojiSize,
                  background: `radial-gradient(circle at 30% 30%, ${persona.accent}, ${persona.accentDeep})`,
                  boxShadow: `0 0 ${enlarged ? 24 : 10}px ${persona.accent}59`,
                }}
              >
                {persona.portrait}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <div
                  className="font-semibold tracking-wider"
                  style={{ color: persona.accent, fontSize: titleSize }}
                >
                  {persona.title} · {persona.name}
                </div>
                <div
                  className="mt-1.5 text-[#8F8A75]"
                  style={{ fontSize: subtitleSize }}
                >
                  {persona.role}
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
            <div className={enlarged ? 'px-5 py-4' : 'px-4 py-3'}>
              <p className="leading-relaxed text-[#EAEEFB]" style={{ fontSize: textSize }}>
                <span style={{ color: persona.accent }}>{persona.selfAddress} </span>
                {line.text}
              </p>

              {(line.action || hasNext) && (
                <div className="mt-3 flex items-center gap-2">
                  {line.action && (
                    <button
                      type="button"
                      onClick={line.action.onClick}
                      className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
                      style={{
                        borderColor: `${persona.accent}66`,
                        background: `${persona.accent}1A`,
                        color: persona.accent,
                      }}
                    >
                      <Sparkles size={10} />
                      {line.action.label}
                    </button>
                  )}
                  {hasNext && (
                    <button
                      type="button"
                      onClick={() => setCursor((c) => (c + 1) % lines.length)}
                      className="ml-auto rounded-md border border-white/10 px-2 py-1 text-[11px] text-[#9AA3C4] transition-colors hover:bg-white/5 hover:text-[#EAEEFB]"
                    >
                      再说一句
                    </button>
                  )}
                </div>
              )}
            </div>

            {hasNext && (
              <div
                className="flex items-center justify-center gap-1 border-t bg-black/20 py-1.5"
                style={{ borderColor: `${persona.accent}1A` }}
              >
                {lines.map((_, i) => (
                  <span
                    key={i}
                    className="h-1 w-1 rounded-full transition-colors"
                    style={{
                      background:
                        i === cursor % lines.length ? persona.accent : `${persona.accent}40`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className="pointer-events-none absolute -right-1 bottom-8 h-3 w-3 rotate-45"
            style={{
              background: 'rgba(10, 8, 4, 0.96)',
              borderRight: `1px solid ${persona.accent}59`,
              borderTop: `1px solid ${persona.accent}59`,
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex items-center justify-center rounded-full border text-[24px] transition-all hover:scale-105"
          style={{
            height: enlarged ? 64 : 48,
            width: enlarged ? 64 : 48,
            borderColor: `${persona.accent}66`,
            background: `radial-gradient(circle at 30% 30%, ${persona.accent}, ${persona.accentDeep})`,
            boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 24px ${persona.accent}66`,
          }}
          aria-label={`召唤 ${persona.name}`}
          title={`按 ? 召唤 ${persona.name}`}
        >
          {persona.compactGlyph}
        </button>
      )}

      {!open && (
        <div
          className="pointer-events-none absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: persona.accent, color: '#04060E' }}
          aria-hidden
        >
          <HelpCircle size={11} strokeWidth={3} />
        </div>
      )}

      <style jsx>{`
        @keyframes mascotIn {
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
