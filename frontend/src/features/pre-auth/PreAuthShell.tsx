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
        <Link href="/" className={styles.brand}>朝堂 OS</Link>
        <nav className={styles.navigation} aria-label="公共入口">
          <Link href="/login">登录</Link>
          <Link href="/register">注册</Link>
        </nav>
      </header>
      <div className={styles.frame}>
        <section className={styles.introduction} aria-labelledby="pre-auth-title">
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 id="pre-auth-title" className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </section>
        <section className={styles.panel} aria-label={title}>
          {children}
          {footer ? <footer className={styles.formFooter}>{footer}</footer> : null}
        </section>
      </div>
      <footer className={styles.siteFooter}>
        <span>chaotang-os · 数字朝堂</span>
        <span>独立朝堂 · Agent 自动办理 · v5</span>
      </footer>
    </main>
  );
}
