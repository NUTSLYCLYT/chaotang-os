import type { ReactNode } from "react";

import styles from "./EdictScrollShell.module.css";

export function EdictScrollShell({ children }: { children: ReactNode }) {
  return (
    <section className={styles.stage} aria-label="圣旨展示面板">
      <span className={`${styles.roller} ${styles.rollerLeft}`} aria-hidden />
      <span className={`${styles.roller} ${styles.rollerRight}`} aria-hidden />
      <div className={styles.paper}>
        <span className={styles.sealRing} aria-hidden />
        <span className={styles.innerRailLeft} aria-hidden />
        <span className={styles.innerRailRight} aria-hidden />
        <span className={styles.brocadeTop} aria-hidden />
        <span className={styles.brocadeBottom} aria-hidden />
        <span className={styles.seal} aria-hidden>奉天承运</span>
        <div className={styles.content}>{children}</div>
      </div>
    </section>
  );
}
