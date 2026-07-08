import type { ReactNode } from 'react';
import type { TradeOrder } from '@/shared/battery-exchange';

export function OperatorPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
      <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function OperatorMetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[22px] border border-[#32261d] bg-[#15110f] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#a97f52]">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-[#f2dfc3]">{value}</div>
      <div className="mt-2 text-xs leading-6 text-[#bb9d78]">{note}</div>
    </div>
  );
}

export function OperatorBadge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">{children}</span>;
}

export function OperatorFilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 transition ${
        active
          ? 'border-[#c98a49] bg-[#22170f] text-[#f0c27b]'
          : 'border-[#3f2e22] bg-[#14110f] text-[#d9bb97]'
      }`}
    >
      {children}
    </button>
  );
}

export function OperatorFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-2 text-xs text-[#d9bb97]">
      <span className="uppercase tracking-[0.18em] text-[#a97f52]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[#3f2e22] bg-[#14110f] px-3 py-2.5 text-sm text-[#f4ead1] outline-none transition focus:border-[#c98a49]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#14110f] text-[#f4ead1]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function OperatorEmptyNotice({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4 text-sm leading-7 text-[#cfb08b]">
      {text}
    </div>
  );
}

export function formatOperatorTradeStatus(status: TradeOrder['status']) {
  switch (status) {
    case 'awaiting_escrow':
      return '待托管';
    case 'awaiting_inspection':
      return '待验货';
    case 'ready_to_release':
      return '待放款';
    case 'in_dispute':
      return '争议中';
    default:
      return status;
  }
}

export function formatOperatorAmount(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}
