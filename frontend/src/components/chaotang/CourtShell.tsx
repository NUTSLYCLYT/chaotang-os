import type { ReactNode } from "react";

import { ChaotangHeader } from "./ChaotangHeader";
import styles from "./CourtShell.module.css";

export function CourtShell({ children, currentLabel, currentPath }: {
  children: ReactNode;
  currentLabel: string;
  currentPath: string;
}) {
  return (
    <div className={styles.shell} data-court-shell>
      <ChaotangHeader currentLabel={currentLabel} currentPath={currentPath} />
      <main className={styles.content} data-court-content>
        {children}
      </main>
    </div>
  );
}
