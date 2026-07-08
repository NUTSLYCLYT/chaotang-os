import type { StatusTone } from '../data/mockDadianData';

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}

const toneClass: Record<StatusTone, string> = {
  healthy: 'text-[#3DD68C]',
  warning: 'text-[#F5A524]',
  danger: 'text-[#F43F5E]',
  processing: 'text-[#F5A524]',
  neutral: 'text-[#C9C0AC]',
};

export function StatCard({ label, value, detail, tone }: StatCardProps) {
  return (
    <div className="rounded-[6px] border border-[#C59648]/18 bg-[#02070d]/44 p-3 shadow-[inset_0_1px_0_rgba(255,238,190,0.05)] transition duration-200 hover:border-[#F0C66A]/32 hover:bg-[#06111f]/68">
      <p className="text-[11px] text-[#C9C0AC]/72">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className={`text-[28px] font-semibold leading-none ${toneClass[tone]}`}>{value}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-[#F0C66A]/26 to-transparent" />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-[#F3EDDF]/64">{detail}</p>
    </div>
  );
}
