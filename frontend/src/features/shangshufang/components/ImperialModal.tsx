'use client';

/**
 * ImperialModal · 上书房弹窗（教学 / 裁决确认）
 * 半透明遮罩 + 深蓝玻璃卡 + 暗金描边；Esc / 点遮罩关闭。
 */

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ImperialModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  accent?: string;
  maxWidth?: number;
}

export function ImperialModal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  accent = '#F0C66A',
  maxWidth = 460,
}: ImperialModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative flex max-h-[calc(100dvh-32px)] w-full flex-col overflow-hidden rounded-2xl"
        style={{
          maxWidth,
          background: 'linear-gradient(180deg, rgba(12,16,34,0.96) 0%, rgba(6,9,20,0.98) 100%)',
          border: `1px solid ${accent}44`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3), inset 0 1px 0 ${accent}18`,
        }}
      >
        <header
          className="flex flex-none items-start justify-between gap-3 border-b px-5 py-3.5"
          style={{ borderColor: `${accent}1f` }}
        >
          <div>
            {eyebrow && (
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>
                {eyebrow}
              </div>
            )}
            <h3
              className="mt-0.5 text-[16px] font-semibold text-[#F5E9C9]"
              style={{ fontFamily: 'var(--font-serif)', letterSpacing: '0.04em' }}
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[#9AA3C4] transition hover:bg-white/10 hover:text-[#F0C66A]"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[13px] leading-[1.85] text-[#D7DFF2]">
          {children}
        </div>

        {footer && (
          <footer
            className="flex flex-none flex-wrap items-center justify-end gap-2 border-t px-5 py-3"
            style={{ borderColor: `${accent}1f`, background: 'rgba(0,0,0,0.2)' }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
