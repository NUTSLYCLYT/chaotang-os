'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { useAppStore } from '@/lib/store/app-store';
import { HR_SCENARIOS } from '../data/hr-scenarios';

export function HrScenarioCards() {
  const router = useRouter();
  const setPendingCommandText = useAppStore((s) => s.setPendingCommandText);

  const handleSelect = (fullText: string) => {
    setPendingCommandText(fullText);
    router.push('/command-center');
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {HR_SCENARIOS.map((scenario) => (
        <button
          key={scenario.id}
          type="button"
          onClick={() => handleSelect(scenario.fullText)}
          className="group rounded-xl border border-white/8 bg-white/[0.025] p-4 text-left transition-all hover:border-[#60A5FA]/25 hover:bg-[#60A5FA]/[0.04]"
        >
          <div className="flex items-center gap-2">
            <Users size={13} className="text-[#60A5FA] opacity-70" />
            <div className="text-[11px] font-semibold text-[#60A5FA]">{scenario.title}</div>
          </div>
          <p className="mt-2.5 text-[12px] leading-[1.7] text-[#A0A8C0]">{scenario.preview}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[#60A5FA] opacity-60 transition group-hover:opacity-100">
            用此场景下令
            <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      ))}
    </div>
  );
}
