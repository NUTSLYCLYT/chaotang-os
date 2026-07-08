import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type IconLike = ComponentType<{ size?: number; className?: string }>;

export type DepartmentMetricItem = {
  label: string;
  value: ReactNode;
  color: string;
  icon?: IconLike;
  unit?: string;
  sub?: ReactNode;
};

export type DepartmentLinkItem = {
  href: string;
  label: string;
  color: string;
  icon?: IconLike;
};

function gridClass(columns: 2 | 3) {
  return columns === 3 ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2';
}

export function DepartmentMetricGrid({
  items,
  columns = 2,
}: {
  items: DepartmentMetricItem[];
  columns?: 2 | 3;
}) {
  return (
    <div className={gridClass(columns)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border p-2.5"
          style={{ borderColor: `${item.color}20`, background: `${item.color}06` }}
        >
          <div className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] text-[#6A7299]">
            {item.icon ? <item.icon size={11} /> : null}
            {item.label}
          </div>
          <div className="mt-1 font-mono text-[16px] font-semibold" style={{ color: item.color }}>
            {item.value}
            {item.unit ? <span className="ml-0.5 text-[10px] font-normal">{item.unit}</span> : null}
          </div>
          {item.sub ? <div className="text-[9px] text-[#6A7299]">{item.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function DepartmentDetailBlock({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: IconLike;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border p-3" style={{ borderColor: `${accent}22`, background: `${accent}08` }}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em]" style={{ color: accent }}>
        <Icon size={13} />
        {title}
      </div>
      {children}
    </div>
  );
}

export function DepartmentQuickLinksBlock({
  title,
  icon: Icon,
  accent,
  items,
}: {
  title: string;
  icon: IconLike;
  accent: string;
  items: DepartmentLinkItem[];
}) {
  return (
    <DepartmentDetailBlock title={title} icon={Icon} accent={accent}>
      <div className="space-y-1.5">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className="flex items-center justify-between rounded border px-2.5 py-1.5 text-[10px] transition hover:bg-white/[0.03]"
            style={{ borderColor: `${item.color}30`, color: item.color }}
          >
            <span className="flex items-center gap-1.5">
              {item.icon ? <item.icon size={11} /> : null}
              {item.label}
            </span>
            <ChevronRight size={11} />
          </Link>
        ))}
      </div>
    </DepartmentDetailBlock>
  );
}
