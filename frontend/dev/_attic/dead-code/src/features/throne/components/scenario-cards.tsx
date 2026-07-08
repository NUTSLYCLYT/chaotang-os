'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Scale } from 'lucide-react';
import { useAppStore } from '@/lib/store/app-store';
import { LCR_001_SCENARIOS } from '../data/lcr-001-scenarios';

export function ScenarioCards() {
  const router = useRouter();
  const setPendingCommandText = useAppStore((s) => s.setPendingCommandText);

  const handleSelect = (fullText: string) => {
    setPendingCommandText(fullText);
    router.push('/command-center');
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {LCR_001_SCENARIOS.map((scenario) => (
        <button
          key={scenario.id}
          type="button"
          onClick={() => handleSelect(scenario.fullText)}
          className="group rounded-2xl border border-white/8 bg-white/[0.025] p-5 text-left transition-all hover:border-[#F0C66A]/25 hover:bg-[#F0C66A]/[0.04]"
        >
          <div className="flex items-center gap-2">
            <Scale size={13} className="text-[#F0C66A] opacity-70" />
            <div className="text-[11px] font-semibold text-[#F0C66A]">{scenario.title}</div>
          </div>
          <p className="mt-3 text-[12px] leading-[1.7] text-[#A0A8C0]">{scenario.preview}</p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-[#F0C66A] opacity-60 transition group-hover:opacity-100">
            用此场景下令
            <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      ))}
    </div>
  );
}
