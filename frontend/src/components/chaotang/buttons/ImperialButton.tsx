import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'panel';

interface BaseProps {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  variant?: ButtonVariant;
}

interface LinkButtonProps extends BaseProps {
  href: string;
}

type NativeButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'border-[#F0C66A]/70 bg-[linear-gradient(180deg,rgba(240,198,106,0.92),rgba(168,133,63,0.92))] text-[#120D04] shadow-[0_16px_44px_rgba(240,198,106,0.18),inset_0_1px_0_rgba(255,255,255,0.45)] hover:shadow-[0_18px_58px_rgba(240,198,106,0.26),inset_0_1px_0_rgba(255,255,255,0.5)]',
  ghost:
    'border-[#F0C66A]/30 bg-[#F0C66A]/[0.045] text-[#F0C66A] hover:border-[#F0C66A]/60 hover:bg-[#F0C66A]/[0.09]',
  panel:
    'border-white/12 bg-white/[0.045] text-[#F3EDDF] hover:border-[#F0C66A]/36 hover:bg-white/[0.075] hover:text-[#F0C66A]',
};

const baseClass =
  'group relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-[8px] border px-4 py-2.5 text-[13px] font-semibold tracking-[0.02em] transition duration-200 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F0C66A]/60';

export function ImperialButton(props: LinkButtonProps | NativeButtonProps) {
  const { children, icon, className = '', variant = 'panel' } = props;
  const classes = `${baseClass} ${variantClass[variant]} ${className}`.trim();

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={classes}>
        <span
          aria-hidden
          className="absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-white/22 opacity-0 transition duration-500 group-hover:left-[115%] group-hover:opacity-100"
        />
        <span className="relative z-10 inline-flex items-center gap-2">
          {icon}
          {children}
        </span>
      </Link>
    );
  }

  const { children: _children, icon: _icon, className: _className, variant: _variant, href: _href, ...buttonProps } =
    props as NativeButtonProps;
  void _children;
  void _icon;
  void _className;
  void _variant;
  void _href;
  return (
    <button type="button" {...buttonProps} className={classes}>
      <span
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-white/22 opacity-0 transition duration-500 group-hover:left-[115%] group-hover:opacity-100"
      />
      <span className="relative z-10 inline-flex items-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  );
}

export function PrimaryCommandButton(props: Omit<LinkButtonProps, 'variant'>) {
  return <ImperialButton {...props} variant="primary" className={`px-5 ${props.className ?? ''}`} />;
}

export function GhostGoldButton(props: Omit<LinkButtonProps, 'variant'>) {
  return <ImperialButton {...props} variant="ghost" />;
}
