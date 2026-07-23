import Link from "next/link";

import styles from "./ChaotangHeader.module.css";

export function ChaotangHeader({ currentLabel }: { currentLabel: string }) {
  return (
    <header className={styles.header} data-three-axis-topnav aria-label="朝堂主导航">
      <Link className={styles.brand} href="/study" aria-label="返回上书房">
        <span className={styles.emblem} aria-hidden>
          <svg viewBox="0 0 64 64" role="img">
            <path d="M44 27c11 4 12 18 2 24-10 5-23 3-28-7-4-8-1-16 8-17" />
            <path d="M44 27c5-5 5-14-2-17-6-3-13 0-13 6-5 0-8 3-6 7-3 1-3 5 1 5 0 3 4 4 7 2 5 1 10 0 13-3Z" />
            <circle cx="38" cy="17" r="2" className={styles.eye} />
            <circle cx="10" cy="32" r="4" className={styles.pearl} />
          </svg>
        </span>
        <span className={styles.brandCopy}>
          <b>朝堂 OS</b>
          <small>上值朝 · AI 智能办公</small>
        </span>
      </Link>
      <nav className={styles.nav} aria-label="部门导航">
        <Link href="/study" aria-current="page">上书房</Link>
        <Link href="/shiguan">史馆</Link>
      </nav>
      <p className={styles.location}>内廷 · {currentLabel}</p>
    </header>
  );
}
