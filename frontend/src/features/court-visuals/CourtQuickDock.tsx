import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

import styles from "./CourtQuickDock.module.css";
import { resolveCourtQuickDockLayout } from "./courtQuickDockLayout";

interface CourtQuickDockProps {
  centerSlot?: ReactElement | null;
  showHandle?: boolean;
}

export function CourtQuickDock({
  centerSlot = null,
  showHandle = true,
}: CourtQuickDockProps) {
  const layout = resolveCourtQuickDockLayout(centerSlot);
  const layoutClassName =
    layout === "with-center"
      ? styles.dockWithCenter
      : styles.dockWithoutCenter;

  return (
    <footer
      className={`${styles.dock} ${layoutClassName}`}
      aria-label="御前快捷入口"
    >
      <Link href="/study" className={styles.adviser}>
        <span className={styles.portrait} aria-hidden="true">
          <Image src="/shangshufang/portrait-chancellor.webp" alt="" width={124} height={222} />
          <span className={styles.portraitIcon}>议</span>
        </span>
        <span>
          <strong>问丞相</strong>
          <small>先压判断与缺证</small>
        </span>
      </Link>
      {showHandle ? <Link href="/study" className={styles.handle}>展开辅政</Link> : null}
      {layout === "with-center" ? (
        <div className={styles.centerSlot} data-court-dock-center>
          {centerSlot}
        </div>
      ) : null}
      <Link href="/study#qintian" className={`${styles.adviser} ${styles.astronomer}`}>
        <span>
          <strong>问钦天监</strong>
          <small>先看时机与风险</small>
        </span>
        <span className={styles.portrait} aria-hidden="true">
          <Image src="/shangshufang/portrait-wang.webp" alt="" width={118} height={220} />
          <span className={`${styles.portraitIcon} ${styles.qintianIcon}`}>象</span>
        </span>
      </Link>
    </footer>
  );
}
