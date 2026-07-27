import type { ReactNode } from "react";

import { EdictStage } from "../court-visuals/edict/EdictStage";
import styles from "./ministries.module.css";

export function DepartmentRailPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.departmentRailPanel} data-department-rail-panel>
      <header className={styles.departmentRailHeader}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </header>
      <div className={styles.departmentRailBody}>{children}</div>
    </div>
  );
}

export function DepartmentEdictStage({
  titleId,
  kicker,
  title,
  subtitle,
  children,
  footer,
}: {
  titleId: string;
  kicker: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <EdictStage
      className={styles.departmentEdictStage}
      document={{ id: `${titleId}:${title}`, kicker, title, issuer: subtitle }}
      bodyLabel={`${title}正文`}
      footer={<div className={styles.departmentEdictActions}>{footer}</div>}
    >
      <div className={styles.departmentEdictBody}>{children}</div>
    </EdictStage>
  );
}
