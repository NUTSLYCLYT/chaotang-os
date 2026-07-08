'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store/app-store';
import { MANOR_SCENARIO_GROUPS } from '../data/manor-scenarios';

const ACCENT: Record<string, string> = {
  legal:       '#F0C66A',
  hr:          '#60A5FA',
  finance:     '#34D399',
  compliance:  '#A78BFA',
  investment:  '#FBBF24',
  sales:       '#F97316',
  marketing:   '#EC4899',
  ops:         '#06B6D4',
  ecommerce:   '#84CC16',
  'supply-chain': '#F472B6',
  battery_pack:   '#22D3EE',
};

export function ManorScenarioBrowser() {
  const router = useRouter();
  const setPendingCommandText = useAppStore((s) => s.setPendingCommandText);
  const [activeIdx, setActiveIdx] = useState(0);

  const active = MANOR_SCENARIO_GROUPS[activeIdx];
  if (!active) return null;
  const accent = ACCENT[active.domain] ?? '#F0C66A';

  const handleSelect = (fullText: string) => {
    setPendingCommandText(fullText);
    router.push('/command-center');
  };

  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-5">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#6A7299]">
            All Manors · 十一庄园示范场景
          </div>
          <div className="mt-1 text-[13px] font-medium" style={{ color: accent }}>
            {active.label} · {active.tagline}
          </div>
        </div>
      </div>

      {/* manor tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {MANOR_SCENARIO_GROUPS.map((g, i) => {
          const a = ACCENT[g.domain] ?? '#F0C66A';
          const isActive = i === activeIdx;
          return (
            <button
              key={g.domain}
              type="button"
              onClick={() => setActiveIdx(i)}
              className="rounded-full px-3 py-1 text-[11px] font-medium transition-all"
              style={
                isActive
                  ? { background: `${a}20`, color: a, border: `1px solid ${a}50` }
                  : { background: 'rgba(255,255,255,0.03)', color: '#6A7299', border: '1px solid rgba(255,255,255,0.06)' }
              }
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {/* scenario cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {active.scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            onClick={() => handleSelect(scenario.fullText)}
            className="group rounded-xl border border-white/6 bg-white/[0.02] p-4 text-left transition-all"
            style={{ ['--accent' as string]: accent }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.borderColor = `${accent}30`;
              el.style.background = `${accent}06`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.borderColor = '';
              el.style.background = '';
            }}
          >
            <div className="mb-2 text-[12px] font-semibold" style={{ color: accent }}>
              {scenario.title}
            </div>
            <p className="text-[12px] leading-[1.7] text-[#9AA3C4]">{scenario.preview}</p>
            <div
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] opacity-50 transition group-hover:opacity-100"
              style={{ color: accent }}
            >
              用此场景下令
              <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
