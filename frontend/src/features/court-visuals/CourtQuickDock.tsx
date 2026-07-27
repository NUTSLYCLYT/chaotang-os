import Link from "next/link";

import styles from "./CourtQuickDock.module.css";

export function CourtQuickDock() {
  return (
    <footer className={styles.dock} aria-label="御前快捷入口">
      <Link href="/study" className={styles.adviser}>
        <span className={styles.portrait} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/shangshufang/portrait-chancellor.webp" alt="" />
          <span className={styles.portraitIcon}>议</span>
        </span>
        <span>
          <strong>问丞相</strong>
          <small>先压判断与缺证</small>
        </span>
      </Link>
      <Link href="/study" className={styles.handle}>展开辅政</Link>
      <Link href="/study" className={`${styles.adviser} ${styles.astronomer}`}>
        <span>
          <strong>问钦天监</strong>
          <small>先看时机与风险</small>
        </span>
        <span className={styles.portrait} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/shangshufang/portrait-wang.webp" alt="" />
          <span className={`${styles.portraitIcon} ${styles.qintianIcon}`}>象</span>
        </span>
      </Link>
    </footer>
  );
}
