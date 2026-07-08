import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "gold" | "ghost" | "link";

export interface ActionButtonProps {
  children: ReactNode;
  href?: string;
  variant?: Variant;
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  "aria-label"?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const VARIANT_CLS: Record<Variant, string> = {
  gold: "btn-gold rounded-[7px] font-medium justify-center",
  ghost:
    "glow rounded-[7px] border border-[rgba(212,168,75,0.35)] bg-white/[0.03] text-jade justify-center",
  link: "glow rounded-[5px] text-[rgba(212,168,75,0.92)] hover:underline underline-offset-2 justify-center",
};

export default function ActionButton({
  children,
  href,
  variant = "ghost",
  icon,
  iconRight,
  className = "",
  ...rest
}: ActionButtonProps) {
  const cls = `inline-flex items-center gap-[6px] whitespace-nowrap tracking-wide select-none ${VARIANT_CLS[variant]} ${className}`;
  const inner = (
    <>
      {icon ? <span className="shrink-0 leading-none">{icon}</span> : null}
      <span className="leading-none">{children}</span>
      {iconRight ? <span className="shrink-0 leading-none">{iconRight}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls} {...rest}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {inner}
    </button>
  );
}
