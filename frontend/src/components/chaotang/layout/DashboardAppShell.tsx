import type { ReactNode } from 'react';

interface DashboardAppShellProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  floatingChrome?: ReactNode;
  pageDockSlot?: ReactNode;
  contentClassName?: string;
}

export function DashboardAppShell({
  children,
  header,
  footer,
  floatingChrome,
  pageDockSlot,
  contentClassName = '',
}: DashboardAppShellProps) {
  return (
    <div
      data-app-layout="header-content-footer"
      className="flex h-screen flex-col overflow-hidden bg-[#04060E] text-[#EAEEFB]"
    >
      {header ? (
        <div data-layout-region="header" className="relative z-[220] flex-shrink-0">
          {header}
        </div>
      ) : null}
      <main
        id="main-content"
        data-layout-region="content"
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${contentClassName}`}
      >
        {children}
      </main>
      {pageDockSlot ? (
        <div data-layout-region="page-dock" className="relative z-[215] flex-shrink-0">
          {pageDockSlot}
        </div>
      ) : null}
      {footer ? (
        <footer
          data-layout-region="footer"
          className="relative z-[210] flex-shrink-0"
          aria-label="朝堂底部面板"
        >
          {footer}
        </footer>
      ) : null}
      {floatingChrome ? (
        <div data-layout-region="floating-chrome" className="contents">
          {floatingChrome}
        </div>
      ) : null}
    </div>
  );
}
