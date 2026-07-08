import type { AlertItem, StatusTone } from '../data/mockDadianData';

const toneClass: Record<StatusTone, { border: string; text: string; bg: string }> = {
  healthy: { border: 'border-[#3DD68C]/24', text: 'text-[#3DD68C]', bg: 'bg-[#3DD68C]/8' },
  warning: { border: 'border-[#F5A524]/26', text: 'text-[#F5A524]', bg: 'bg-[#F5A524]/8' },
  danger: { border: 'border-[#F43F5E]/30', text: 'text-[#F43F5E]', bg: 'bg-[#F43F5E]/8' },
  processing: { border: 'border-[#F5A524]/26', text: 'text-[#F5A524]', bg: 'bg-[#F5A524]/8' },
  neutral: { border: 'border-white/12', text: 'text-[#C9C0AC]', bg: 'bg-white/[0.04]' },
};

export function AlertCard({ item }: { item: AlertItem }) {
  const Icon = item.icon;
  const tone = toneClass[item.tone];

  return (
    <article className={`rounded-[6px] border ${tone.border} ${tone.bg} p-3 shadow-[inset_0_1px_0_rgba(255,238,190,0.05)]`}>
      <div className="flex gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border ${tone.border} bg-black/18 ${tone.text}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-[0.03em] text-[#F0C66A]">{item.title}</h3>
          <p className="mt-1 text-[12px] leading-5 text-[#F3EDDF]/76">{item.body}</p>
          <p className={`mt-2 text-[10px] tracking-[0.12em] ${tone.text}`}>{item.meta}</p>
        </div>
      </div>
    </article>
  );
}
