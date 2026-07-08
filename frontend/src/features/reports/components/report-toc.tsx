'use client';

import { useEffect, useState } from 'react';
import { List } from 'lucide-react';
import type { ReportSection } from '@/types/report';

export interface ReportTocProps {
  sections: ReportSection[];
}

/**
 * Sticky table of contents. Scroll-spy highlights the active section
 * using IntersectionObserver against `#section-${id}` anchors.
 */
export function ReportToc({ sections }: ReportTocProps) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nodes = sections
      .map((s) => document.getElementById(`section-${s.id}`))
      .filter((n): n is HTMLElement => !!n);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // pick the entry closest to the top that is intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const id = visible.target.id.replace(/^section-/, '');
          setActiveId(id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 1] },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="报告目录"
      className="rounded-2xl border border-white/5 bg-black/20 p-4 backdrop-blur-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <List size={11} className="text-[#F0C66A]" />
        <div>
          <div className="section-eyebrow">文书目录</div>
          <div className="page-meta mt-0.5">按章节阅读，不必往返搜索</div>
        </div>
      </div>
      <ol className="space-y-1.5">
        {sections.map((s, i) => {
          const active = s.id === activeId;
          return (
            <li key={s.id}>
              <a
                href={`#section-${s.id}`}
                className="flex items-baseline gap-2 rounded-xl px-2.5 py-2 text-[11px] transition-colors"
                style={{
                  color: active ? '#F0C66A' : '#9AA3C4',
                  background: active ? 'rgba(240,198,106,0.08)' : 'transparent',
                  borderLeft: active
                    ? '2px solid #F0C66A'
                    : '2px solid transparent',
                }}
              >
                <span className="font-mono text-[9px] opacity-70">
                  §{String(i + 1).padStart(2, '0')}
                </span>
                <span className="line-clamp-2 leading-5">{s.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
