import type { ReactNode } from "react";

import styles from "./preAuth.module.css";

type PreAuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function PreAuthShell({ eyebrow, title, description, children, footer }: PreAuthShellProps) {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.introduction} aria-labelledby="pre-auth-title">
          <p className={styles.eyebrow}>COURTOS · {eyebrow}</p>
          <div className={styles.seal} aria-hidden="true">朝</div>
          <h1 id="pre-auth-title" className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
          <p className={styles.motto}>明德慎刑 · 协同议政</p>
        </section>
        <section className={styles.panel} aria-label={title}>
          {children}
          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </section>
      </div>
    </main>
  );
}
