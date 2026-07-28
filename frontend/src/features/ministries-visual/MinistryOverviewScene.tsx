import Link from "next/link";
import { useMemo, type CSSProperties } from "react";

import type { ReplyCaseView } from "../court-replies/replyFeed";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import {
  DEPARTMENT_DIRECTORY,
  type DepartmentDirectoryEntry,
} from "./departmentDirectory";
import type { MinistriesControllerState } from "./ministriesController";
import {
  projectMinistryMetrics,
  projectMinistryReplies,
  type MinistryReplyProjection,
} from "./ministriesViewModel";
import styles from "./ministries.module.css";

const BACKGROUND_WIDTH = 1672;
const BACKGROUND_HEIGHT = 941;

const MINISTRY_BOXES: Readonly<
  Record<
    DepartmentDirectoryEntry["code"],
    {
      left: number;
      top: number;
      width: number;
      height: number;
    }
  >
> = {
  personnel: { left: 158, top: 128, width: 365, height: 135 },
  finance: { left: 1149, top: 128, width: 365, height: 135 },
  market: { left: 1147, top: 287, width: 430, height: 142 },
  ops: { left: 95, top: 287, width: 430, height: 142 },
  legal: { left: 1158, top: 477, width: 480, height: 186 },
  gongbu: { left: 34, top: 477, width: 480, height: 186 },
};

const MINISTRY_DOMAINS: Readonly<Record<DepartmentDirectoryEntry["code"], string>> = {
  personnel: "组织人才域",
  finance: "财税资荟",
  market: "品牌客户域",
  ops: "任务作战台",
  legal: "风控法务司",
  gongbu: "研发供应链",
};
const DEV_COLORS: Readonly<Record<DepartmentDirectoryEntry["code"], string>> = {
  personnel: "#a99cf0",
  finance: "#ebcb7b",
  market: "#6fd0d8",
  ops: "#e0705a",
  legal: "#6fa0ff",
  gongbu: "#7fc9a8",
};

function MinistryGlyph({ code }: { code: DepartmentDirectoryEntry["code"] }) {
  return <span aria-hidden="true">{code === "finance" ? "贯" : code === "legal" ? "衡" : "印"}</span>;
}

function MinistryCard({
  department,
  view,
  index,
}: {
  department: DepartmentDirectoryEntry;
  view: MinistryReplyProjection;
  index: number;
}) {
  const box = MINISTRY_BOXES[department.code];
  const style = {
    left: `${(box.left / BACKGROUND_WIDTH) * 100}%`,
    top: `${(box.top / BACKGROUND_HEIGHT) * 100}%`,
    width: `${(box.width / BACKGROUND_WIDTH) * 100}%`,
    height: `${(box.height / BACKGROUND_HEIGHT) * 100}%`,
    "--card-color": DEV_COLORS[department.code],
    "--card-delay": `${120 + index * 80}ms`,
  } as CSSProperties;
  return (
    <Link
      className={styles.ministryHotspot}
      data-ministry-hotspot={department.code}
      href={`/liubu/${department.code}`}
      aria-label={`${department.name}府邸；悬停查看办结回奏和最近回奏，点击进入部门页面`}
      style={style}
    >
      <div className={styles.manorPlaque} data-manor-plaque>
        <span className={styles.cardMark} aria-hidden="true">
          <MinistryGlyph code={department.code} />
        </span>
        <strong>{department.name}</strong>
        <span>{MINISTRY_DOMAINS[department.code]}</span>
      </div>
      <section className={styles.manorDetails} aria-label={`${department.name}回奏摘要`}>
        <span className={styles.readonlyBadge}>史馆只读回奏</span>
        <dl className={styles.cardMetrics}>
          {projectMinistryMetrics(view).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <span className={styles.cardRule} aria-hidden="true" />
        <span className={styles.cardStamp} aria-hidden="true">入府详阅</span>
      </section>
    </Link>
  );
}

export function MinistryOverviewScene({
  cases,
  state,
  error,
  retry,
}: {
  cases: ReplyCaseView[] | null;
  state: MinistriesControllerState["status"];
  error: string | null;
  retry(): void;
}) {
  const overviewView = useMemo(
    () => projectMinistryReplies({ state, cases, error }),
    [cases, error, state],
  );
  const viewsByDepartment = useMemo(
    () =>
      Object.fromEntries(
        DEPARTMENT_DIRECTORY.map((department) => [
          department.code,
          projectMinistryReplies({
            state,
            cases,
            error,
            department: department.name,
          }),
        ]),
      ) as Record<DepartmentDirectoryEntry["code"], MinistryReplyProjection>,
    [cases, error, state],
  );

  return (
    <ImmersiveCourtShell
      currentLabel="六部"
      currentPath="/liubu"
      backgroundImage="/assets/zhuangyuan/04-zhuangyuan-liubu-manors.png"
      scene="liubu"
      showVeil={false}
      fullBleedContent
    >
      <section className={styles.overview} aria-labelledby="ministries-heading">
        <header className={styles.overviewHeading}>
          <h1 id="ministries-heading">六部政务分域</h1>
          <p>六部与属司目录为权威静态注册；回奏指标仅来自当前史馆真实 REPLY。</p>
        </header>
        <div className={styles.sceneCoordinates}>
          {DEPARTMENT_DIRECTORY.map((department, index) => (
            <MinistryCard
              key={department.code}
              department={department}
              view={viewsByDepartment[department.code]}
              index={index}
            />
          ))}
        </div>
        {overviewView.status === "loading" ? (
          <div className={styles.overviewReadState} aria-live="polite">
            正在调取史馆真实回奏…
          </div>
        ) : null}
        {overviewView.status === "error" ? (
          <div className={`${styles.readError} ${styles.overviewReadError}`} role="alert">
            <span>{overviewView.error}</span><button type="button" onClick={retry}>重试读取</button>
          </div>
        ) : null}
        {overviewView.status === "empty" ? (
          <div className={styles.overviewReadState}>史馆读取完成，当前暂无真实回奏记录。</div>
        ) : null}
        {overviewView.status === "ready" ? (
          <span className={styles.departmentSrOnly}>史馆真实回奏读取完成</span>
        ) : null}
      </section>
    </ImmersiveCourtShell>
  );
}
