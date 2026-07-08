'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleAlert, FileText, GitBranch, ShieldAlert } from 'lucide-react';

import type { DepartmentRailItem, DepartmentRailSection, DepartmentRailTone } from '@/lib/contracts/department-page-view';

const TONE_CLASS: Record<DepartmentRailTone, { text: string; border: string; bg: string }> = {
  green: { text: 'text-[#7DE3A8]', border: 'border-[#7DE3A8]/25', bg: 'bg-[#7DE3A8]/[0.08]' },
  amber: { text: 'text-[#F0C66A]', border: 'border-[#F0C66A]/25', bg: 'bg-[#F0C66A]/[0.08]' },
  red: { text: 'text-[#FF8A8A]', border: 'border-[#FF8A8A]/25', bg: 'bg-[#FF8A8A]/[0.08]' },
  blue: { text: 'text-[#86A9F2]', border: 'border-[#86A9F2]/25', bg: 'bg-[#86A9F2]/[0.08]' },
  neutral: { text: 'text-[#C8CDD8]', border: 'border-white/10', bg: 'bg-white/[0.04]' },
};

function tone(item: DepartmentRailItem) {
  return TONE_CLASS[item.tone ?? 'neutral'];
}

function iconFor(section: DepartmentRailSection) {
  if (section.kind === 'risk_list' || section.kind === 'blocked_value') return ShieldAlert;
  if (section.kind === 'evidence_list') return FileText;
  if (section.kind === 'handoff_list') return GitBranch;
  if (section.kind === 'decision_list') return CheckCircle2;
  return CircleAlert;
}

function MetricItem({ item }: { item: DepartmentRailItem }) {
  const t = tone(item);
  return (
    <div className={`rounded-[8px] border px-3 py-2 ${t.border} ${t.bg}`}>
      <div className="text-[10px] leading-4 text-[#8F98B8]">{item.label}</div>
      <div className={`mt-1 min-h-[22px] text-[15px] font-semibold ${t.text}`}>{item.value ?? '待核'}</div>
      {item.body ? <div className="mt-1 text-[11px] leading-5 text-[#C8CDD8]">{item.body}</div> : null}
    </div>
  );
}

function ListItem({
  item,
  Icon,
  onSelect,
  selected,
}: {
  item: DepartmentRailItem;
  Icon: ReturnType<typeof iconFor>;
  onSelect?: (item: DepartmentRailItem) => void;
  selected?: boolean;
}) {
  const t = tone(item);
  const actionable = Boolean(item.href || item.actionId);
  const unselectedActionClass = item.actionId ? 'border-[#86A9F2]/45 bg-[#86A9F2]/[0.07]' : `${t.border} ${t.bg}`;
  const content = (
    <div
      className={`group rounded-[8px] border px-3 py-2 transition ${
        selected ? 'border-[#F0C66A]/75 bg-[#F0C66A]/[0.13] shadow-[0_0_0_1px_rgba(240,198,106,0.32)]' : unselectedActionClass
      } ${actionable ? 'hover:brightness-110' : ''}`}
    >
      <div className="flex items-start gap-2">
        <Icon size={14} className={`mt-0.5 shrink-0 ${t.text}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 text-[12px] font-semibold leading-5 text-[#F5E9C9]">{item.label}</div>
            {item.value ? <div className={`shrink-0 text-[11px] font-semibold ${t.text}`}>{item.value}</div> : null}
          </div>
          {item.body ? <div className="mt-1 text-[11px] leading-5 text-[#C8CDD8]">{item.body}</div> : null}
          {item.details?.length ? (
            <div className="mt-2 space-y-1 rounded-[6px] border border-white/10 bg-black/20 px-2 py-2">
              {item.details.map((detail) => (
                <div key={`${item.id}-${detail.label}`} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 text-[10px] leading-4">
                  <span className="text-[#8F98B8]">{detail.label}</span>
                  <span className="break-words font-mono text-[#D7DFF2]">{detail.value}</span>
                </div>
              ))}
            </div>
          ) : null}
          {item.meta ? <div className="mt-1 text-[10px] leading-4 text-[#8F98B8]">{item.meta}</div> : null}
        </div>
        {actionable ? <ArrowRight size={12} className="mt-1 shrink-0 text-[#7C86A6] transition group-hover:translate-x-0.5" /> : null}
      </div>
    </div>
  );
  if (item.href) {
    return (
      <Link href={item.href} className="block">
        {content}
      </Link>
    );
  }
  if (item.actionId && onSelect) {
    return (
      <button type="button" className="block w-full text-left" onClick={() => onSelect(item)}>
        {content}
      </button>
    );
  }
  if (!item.actionId) return content;
  return (
    <button type="button" className="block w-full cursor-default text-left" disabled>
      {content}
    </button>
  );
}

export function RailSectionRenderer({
  section,
  onItemSelect,
  selectedItemId,
}: {
  section: DepartmentRailSection;
  onItemSelect?: (section: DepartmentRailSection, item: DepartmentRailItem) => void;
  selectedItemId?: string | null;
}) {
  const Icon = iconFor(section);
  const isMetric = section.kind === 'metric_strip';

  return (
    <section className="rounded-[8px] border border-white/10 bg-black/20 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F0C66A]">{section.title}</div>
          {section.subtitle ? <div className="mt-1 text-[11px] leading-5 text-[#8F98B8]">{section.subtitle}</div> : null}
        </div>
      </div>

      <div className={isMetric ? 'mt-3 grid grid-cols-2 gap-2' : 'mt-3 space-y-2'}>
        {section.items.map((item) =>
          isMetric ? (
            <MetricItem key={item.id} item={item} />
          ) : (
            <ListItem
              key={item.id}
              item={item}
              Icon={Icon}
              selected={selectedItemId === `${section.id}:${item.id}`}
              onSelect={onItemSelect ? (selected) => onItemSelect(section, selected) : undefined}
            />
          ),
        )}
      </div>
    </section>
  );
}
