import { ReactNode } from "react";

interface GlassPanelProps {
  title?: string;
  /** 标题右侧动作区，如 “换一组”、“›” 等 */
  action?: ReactNode;
  /** 标题左侧装饰小字（副标题气质） */
  eyebrow?: ReactNode;
  id?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export default function GlassPanel({
  title,
  action,
  eyebrow,
  id,
  className = "",
  bodyClassName = "",
  children,
}: GlassPanelProps) {
  return (
    <section
      id={id}
      className={`glass relative overflow-hidden rounded-2xl ${className}`}
    >
      {/* 顶部金线 */}
      <div className="gold-hairline absolute inset-x-0 top-0" />
      {title && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-[3px] rounded-full bg-gradient-to-b from-gold-200 to-gold-500" />
            <h3 className="font-serif text-[15px] font-semibold tracking-wide text-jade-50">
              {title}
            </h3>
            {eyebrow && (
              <span className="text-[11px] text-slatey-400">{eyebrow}</span>
            )}
          </div>
          {action && (
            <div className="text-[12px] text-gold-200/90">{action}</div>
          )}
        </header>
      )}
      <div className={`px-4 pb-4 ${title ? "" : "pt-4"} ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
