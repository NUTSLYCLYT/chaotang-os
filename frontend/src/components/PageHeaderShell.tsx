import Link from 'next/link';

interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}

export function PageHeaderShell({ title, subtitle, breadcrumbs, actions }: Props) {
  return (
    <header className="mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-[12px] font-medium" style={{ color: '#6A7299' }}>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span style={{ color: '#484F72' }}>/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-[#F0C66A]" style={{ color: '#8A92AC' }}>
                  {crumb.label}
                </Link>
              ) : (
                <span style={{ color: '#C6CEE6' }}>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1
            className="text-[24px] font-semibold leading-tight md:text-[28px]"
            style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', letterSpacing: '0.02em' }}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-2 max-w-3xl text-[13px] leading-6" style={{ color: '#AEB7D4' }}>{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
