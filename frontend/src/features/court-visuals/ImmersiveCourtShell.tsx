import { ChaotangHeader } from "../../components/chaotang/ChaotangHeader";
import { CourtQuickDock } from "./CourtQuickDock";
import styles from "./ImmersiveCourtShell.module.css";
import type { ImmersiveCourtShellProps } from "./types";

export function ImmersiveCourtShell({
  children,
  currentLabel,
  currentPath,
  backgroundImage,
  scene,
}: ImmersiveCourtShellProps) {
  return (
    <div
      className={styles.shell}
      data-court-scene={scene}
      style={{ backgroundImage: `url("${backgroundImage}")` }}
    >
      <ChaotangHeader currentLabel={currentLabel} currentPath={currentPath} />
      <div className={styles.veil} aria-hidden="true" />
      <main className={styles.content}>{children}</main>
      <CourtQuickDock />
    </div>
  );
}
