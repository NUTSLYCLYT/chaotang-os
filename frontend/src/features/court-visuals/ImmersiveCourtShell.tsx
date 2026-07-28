import { ChaotangHeader } from "../../components/chaotang/ChaotangHeader";
import { CourtQuickDock } from "./CourtQuickDock";
import styles from "./ImmersiveCourtShell.module.css";
import type { ImmersiveCourtShellProps } from "./types";

export function ImmersiveCourtShell({
  children,
  overlay,
  currentLabel,
  currentPath,
  backgroundImage,
  quickDockCenter,
  showQuickDockHandle = true,
  showVeil = true,
  fullBleedContent = false,
  hideScrollbar = false,
  scene,
}: ImmersiveCourtShellProps) {
  return (
    <div
      className={styles.shell}
      data-court-scene={scene}
      style={{ backgroundImage: `url("${backgroundImage}")` }}
    >
      <ChaotangHeader currentLabel={currentLabel} currentPath={currentPath} />
      {showVeil ? <div className={styles.veil} aria-hidden="true" /> : null}
      <main className={`${styles.content}${fullBleedContent ? ` ${styles.contentFullBleed}` : ""}${hideScrollbar ? ` ${styles.contentScrollbarHidden}` : ""}`}>
        {children}
      </main>
      {overlay}
      <CourtQuickDock centerSlot={quickDockCenter} showHandle={showQuickDockHandle} />
    </div>
  );
}
