import type { ReactNode } from 'react';

import { assetUrl } from '@/lib/asset';
import { SHANGSHUFANG_ASSETS } from '@/features/shangshufang/constants';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function ShangshufangLayoutShell({
  eyebrow,
  title,
  subtitle,
  breadcrumb,
  leadingActions,
  actions,
  left,
  center,
  right,
  footer,
  children,
  accent = '#F0C66A',
  background,
  className,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  breadcrumb?: ReactNode;
  leadingActions?: ReactNode;
  actions?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  accent?: string;
  background?: string;
  className?: string;
}) {
  return (
    <main className={cx('relative h-full min-h-[760px] overflow-hidden bg-[#04060E] text-[#EAEEFB]', className)}>
      <img
        src={assetUrl(background ?? SHANGSHUFANG_ASSETS.bgScene)}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(240,198,106,0.16),rgba(4,6,14,0.68)_42%,rgba(4,6,14,0.96)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/65 to-transparent" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1680px] flex-col px-4 pb-4 pt-5">
        <header className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {breadcrumb ? <div className="mb-1">{breadcrumb}</div> : null}
              {leadingActions ? <div className="mb-1 flex flex-wrap items-center gap-2">{leadingActions}</div> : null}
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>
                {eyebrow}
              </div>
              <h1 className="mt-1 text-[22px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
                {title}
              </h1>
              {subtitle ? <p className="mt-1 max-w-[760px] text-[12px] leading-5 text-[#9AA3C4]">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_330px]">
          <aside data-three-axis-panel="left" className="min-h-0">
            {left}
          </aside>
          <section className="min-h-0">
            {center}
          </section>
          <aside data-three-axis-panel="right" className="min-h-0">
            {right}
          </aside>
        </div>

        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
      {children}
    </main>
  );
}

export function ShangshufangRailPanel({
  title,
  subtitle,
  headerActions,
  accent = '#F0C66A',
  children,
}: {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl"
      style={{
        borderColor: `${accent}30`,
        background:
          'linear-gradient(180deg, rgba(10,10,16,0.86), rgba(5,7,13,0.78) 52%, rgba(6,5,7,0.88)), radial-gradient(circle at 50% -12%, rgba(240,198,106,0.12), transparent 44%)',
      }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: `${accent}20` }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
            {title}
          </div>
          {headerActions ? <div className="flex shrink-0 items-center gap-1.5">{headerActions}</div> : null}
        </div>
        {subtitle ? <div className="mt-1 text-[11px] leading-5 text-[#8F98B8]">{subtitle}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}
