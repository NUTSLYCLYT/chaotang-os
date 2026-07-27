import Link from "next/link";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

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

export const CANVAS_WIDTH = 1672;
export const CANVAS_HEIGHT = 941;
const TOP_CROP = 52;

const MINISTRY_BOXES: Readonly<
  Record<
    DepartmentDirectoryEntry["code"],
    { left: number; top: number; width: number; height: number }
  >
> = {
  personnel: { left: 320, top: 125, width: 240, height: 110 },
  finance: { left: 735, top: 85, width: 230, height: 110 },
  market: { left: 1075, top: 200, width: 230, height: 110 },
  ops: { left: 405, top: 320, width: 220, height: 110 },
  legal: { left: 1015, top: 385, width: 250, height: 110 },
  gongbu: { left: 420, top: 465, width: 240, height: 110 },
};

const MINISTRY_TITLES: Readonly<Record<DepartmentDirectoryEntry["code"], string>> = {
  personnel: "吏部 · 组织人才域",
  finance: "户部 · 财税资荟",
  market: "礼部 · 品牌客户域",
  ops: "兵部 · 任务作战台",
  legal: "刑部 · 风控法务司",
  gongbu: "工部 · 研发供应链",
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
  selected,
  onSelect,
}: {
  department: DepartmentDirectoryEntry;
  view: MinistryReplyProjection;
  index: number;
  selected: boolean;
  onSelect(): void;
}) {
  const style = {
    ...MINISTRY_BOXES[department.code],
    "--card-color": DEV_COLORS[department.code],
    "--card-delay": `${120 + index * 80}ms`,
  } as CSSProperties;
  return (
    <article
      className={styles.ministryHotspot}
      data-ministry-hotspot={department.code}
      data-selected={selected || undefined}
      style={style}
    >
      <button
        className={styles.cardSelect}
        type="button"
        aria-pressed={selected}
        aria-label={`查看${department.name}属司`}
        onClick={onSelect}
      />
      <div className={styles.cardTitle}>
        <Link className={styles.cardMark} href={`/liubu/${department.code}`} aria-label={`前往${department.name}部门页面`}>
          <MinistryGlyph code={department.code} />
        </Link>
        <strong>{MINISTRY_TITLES[department.code]}</strong>
      </div>
      <span className={styles.readonlyBadge}>只读目录</span>
      <dl className={styles.cardMetrics}>
        {projectMinistryMetrics(view).map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <span className={styles.cardRule} aria-hidden="true" />
      <span className={styles.cardStamp} aria-hidden="true">览</span>
    </article>
  );
}

function SelectedMinistryRail({
  department,
  view,
}: {
  department: DepartmentDirectoryEntry;
  view: MinistryReplyProjection;
}) {
  return (
    <aside
      className={styles.selectedMinistryRail}
      data-selected-ministry-rail
      style={{ "--accent": DEV_COLORS[department.code] } as CSSProperties}
      aria-label={`${department.name}属司`}
    >
      <div className={styles.railEyebrow}>{department.name} · OFFICE RAIL</div>
      <div className={styles.railTitle}><span aria-hidden="true" /><div><p>只读目录</p><h2>{department.name}属司</h2></div></div>
      <div className={styles.railSummary}><span>回奏记录</span><strong>{view.countLabel}</strong></div>
      <ul>
        {department.offices.map((office, index) => (
          <li key={office.slug}>
            <Link href={`/liubu/${department.code}/${office.slug}`}>
              <span>0{index + 1}</span><strong>{office.name}</strong><small>进入</small>
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.railBoundary}>属司目录来自当前 canonical 注册表；这里不推断逐司意见或实时工作量。</p>
    </aside>
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [selectedCode, selectMinistry] = useState<DepartmentDirectoryEntry["code"] | null>(null);
  const selected = DEPARTMENT_DIRECTORY.find((department) => department.code === selectedCode) ?? null;
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

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      if (viewport.clientWidth > 0 && viewport.clientHeight > 0) {
        setScale(Math.max(
          viewport.clientWidth / CANVAS_WIDTH,
          viewport.clientHeight / (CANVAS_HEIGHT - TOP_CROP),
        ));
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <ImmersiveCourtShell
      currentLabel="六部"
      currentPath="/liubu"
      backgroundImage="/assets/zhuangyuan/04-zhuangyuan-new.webp"
      scene="liubu"
    >
      <section className={styles.overview} aria-labelledby="ministries-heading">
        <header className={styles.overviewHeading}>
          <h1 id="ministries-heading">六部政务分域</h1>
          <p>六部与属司目录为权威静态注册；回奏指标仅来自当前史馆真实 REPLY。</p>
        </header>
        <div className={styles.canvasViewport} ref={viewportRef}>
          {selected ? (
            <SelectedMinistryRail
              department={selected}
              view={viewsByDepartment[selected.code]}
            />
          ) : null}
          <div
            className={styles.canvas}
            style={{
              "--canvas-width": CANVAS_WIDTH,
              "--canvas-height": CANVAS_HEIGHT,
              "--canvas-scale": scale,
              "--top-crop": `${TOP_CROP * scale}px`,
            } as CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.canvasImage} src="/assets/zhuangyuan/04-zhuangyuan-new.webp" alt="六部宫苑全景" draggable={false} />
            {DEPARTMENT_DIRECTORY.map((department, index) => (
              <MinistryCard
                key={department.code}
                department={department}
                view={viewsByDepartment[department.code]}
                index={index}
                selected={selectedCode === department.code}
                onSelect={() => selectMinistry((current) => current === department.code ? null : department.code)}
              />
            ))}
          </div>
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
