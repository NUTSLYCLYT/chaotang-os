import Link from "next/link";
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
    <main className={styles.page} data-public-entry-shell>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="朝堂 OS 首页"><span aria-hidden>朝</span><b>朝堂 OS<small>COURTOS</small></b></Link>
        <nav aria-label="公共入口"><Link href="/login">已有账号</Link><Link href="/register" className={styles.topCta}>创建朝堂</Link></nav>
      </header>
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
