"use client";

import type { ReactNode } from "react";

import styles from "./AdvisorDrawerShell.module.css";

export interface AdvisorDrawerShellProps {
  side: "left" | "right";
  phase: "opening" | "closing";
  bounds?: { top: number; height: number } | null;
  portrait: string;
  name: string;
  duty: string;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
  id?: string;
}

export function AdvisorDrawerShell({
  side,
  phase,
  bounds,
  portrait,
  name,
  duty,
  children,
  footer,
  testId,
  id,
}: AdvisorDrawerShellProps) {
  return (
    <aside
      id={id}
      className={styles.shell}
      data-advisor-side={side}
      data-advisor-phase={phase}
      style={bounds ? { top: bounds.top, height: bounds.height } : undefined}
      data-testid={testId}
      role="dialog"
      aria-label={`${name}辅助区`}
    >
      <header className={styles.header} data-advisor-region="header">
        <span className={styles.ornament} aria-hidden>◈</span>
        <div className={styles.portrait}>
          <span className={styles.portraitGlow} aria-hidden />
          <span
            className={styles.portraitImage}
            style={{ backgroundImage: `url(${portrait})` }}
            role="img"
            aria-label={`${name} 立像`}
          />
        </div>
        <strong>{name}</strong>
        <span className={styles.duty}>{duty}</span>
      </header>
      <div className={styles.divider} aria-hidden />
      <div className={styles.body} data-advisor-region="body">{children}</div>
      {footer !== undefined && (
        <footer className={styles.footer} data-advisor-region="footer">{footer}</footer>
      )}
    </aside>
  );
}
