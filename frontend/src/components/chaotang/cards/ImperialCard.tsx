import type { HTMLAttributes, ReactNode } from 'react';

export type ImperialCardTone = 'gold' | 'jade' | 'amber' | 'vermilion' | 'blue' | 'neutral';

interface ImperialCardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  tone?: ImperialCardTone;
  children: ReactNode;
}

const toneBorder: Record<ImperialCardTone, string> = {
  gold: 'border-[#C59648]/50 shadow-[0_22px_70px_rgba(0,0,0,0.48),inset_0_0_0_1px_rgba(255,235,180,0.08),inset_0_18px_44px_rgba(240,198,106,0.055)]',
  jade: 'border-[#3DD68C]/36 shadow-[0_22px_70px_rgba(0,0,0,0.48),inset_0_0_0_1px_rgba(61,214,140,0.08)]',
  amber: 'border-[#C59648]/48 shadow-[0_22px_70px_rgba(0,0,0,0.48),inset_0_0_0_1px_rgba(245,165,36,0.08)]',
  vermilion: 'border-[#F43F5E]/42 shadow-[0_22px_70px_rgba(0,0,0,0.48),inset_0_0_0_1px_rgba(244,63,94,0.08)]',
  blue: 'border-[#60A5FA]/34 shadow-[0_22px_70px_rgba(0,0,0,0.48),inset_0_0_0_1px_rgba(96,165,250,0.08)]',
  neutral: 'border-[#C9C0AC]/18 shadow-[0_22px_70px_rgba(0,0,0,0.46),inset_0_0_0_1px_rgba(255,255,255,0.05)]',
};

export function ImperialCard({
  title,
  eyebrow,
  action,
  tone = 'gold',
  className = '',
  children,
  ...rest
}: ImperialCardProps) {
  return (
    <section
      className={`group relative overflow-hidden rounded-[7px] border bg-[#06111f]/78 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-[#071522]/86 ${toneBorder[tone]} ${className}`.trim()}
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/58 to-transparent opacity-70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(135deg,rgba(255,236,180,0.18)_0,transparent_28%,transparent_72%,rgba(197,150,72,0.16)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l border-t border-[#F0C66A]/42"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t border-[#F0C66A]/42"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b border-l border-[#F0C66A]/28"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r border-[#F0C66A]/28"
      />
      {(title || eyebrow || action) && (
        <header className="relative flex items-start justify-between gap-4 px-4 pt-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8F835F]">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-1 text-[15px] font-semibold tracking-[0.06em] text-[#F0C66A]">
                {title}
              </h2>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="relative p-4">{children}</div>
    </section>
  );
}
