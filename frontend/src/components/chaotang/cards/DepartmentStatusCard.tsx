import type { DepartmentStatus, StatusTone } from '../data/mockDadianData';

const toneClass: Record<StatusTone, { dot: string; text: string; bar: string }> = {
  healthy: { dot: 'bg-[#3DD68C]', text: 'text-[#3DD68C]', bar: 'bg-[#3DD68C]' },
  warning: { dot: 'bg-[#F5A524]', text: 'text-[#F5A524]', bar: 'bg-[#F5A524]' },
  danger: { dot: 'bg-[#F43F5E]', text: 'text-[#F43F5E]', bar: 'bg-[#F43F5E]' },
  processing: { dot: 'bg-[#F5A524]', text: 'text-[#F5A524]', bar: 'bg-[#F5A524]' },
  neutral: { dot: 'bg-[#C9C0AC]', text: 'text-[#C9C0AC]', bar: 'bg-[#C9C0AC]' },
};

export function DepartmentStatusCard({ department }: { department: DepartmentStatus }) {
  const tone = toneClass[department.tone];

  return (
    <article className="rounded-[6px] border border-[#C59648]/18 bg-[#02070d]/46 p-3 shadow-[inset_0_1px_0_rgba(255,238,190,0.05)] transition duration-200 hover:border-[#F0C66A]/34 hover:bg-[#06111f]/68">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[#F3EDDF]">{department.name}</h3>
          <p className="mt-1 truncate text-[11px] text-[#C9C0AC]/68">{department.role}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] ${tone.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} shadow-[0_0_10px_currentColor]`} />
          {department.status}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full border border-black/35 bg-black/38">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: department.load }} />
      </div>
    </article>
  );
}
