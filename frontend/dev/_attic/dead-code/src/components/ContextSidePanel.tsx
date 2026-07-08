'use client';
import { useState } from 'react';
import { GlassPanel } from '@/components/GlassPanel';

interface Props {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function ContextSidePanel({ title, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="overflow-hidden transition-all duration-200 ease-in-out flex-shrink-0"
      style={{ width: open ? '100%' : '2rem' }}
    >
      {open ? (
        <GlassPanel variant="default" tone="elevated" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-eyebrow">{title}</h2>
            <button
              onClick={() => setOpen(false)}
              className="text-xs leading-none transition-colors"
              style={{ color: '#6A7299' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#EAEEFB')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6A7299')}
              aria-label="收起"
            >
              ›
            </button>
          </div>
          {children}
        </GlassPanel>
      ) : (
        <GlassPanel
          tone="flat"
          className="h-full flex items-center justify-center cursor-pointer py-4"
          onClick={() => setOpen(true)}
          role="button"
          aria-label="展开"
        >
          <span
            className="text-xs select-none"
            style={{ color: '#6A7299', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {title}
          </span>
        </GlassPanel>
      )}
    </div>
  );
}
