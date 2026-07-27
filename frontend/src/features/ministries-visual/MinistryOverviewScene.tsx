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
const LIVE_DEPARTMENTS = new Set<DepartmentDirectoryEntry["code"]>([
  "personnel",
  "finance",
  "ops",
  "legal",
  "gongbu",
]);

function MinistryGlyph({ code }: { code: DepartmentDirectoryEntry["code"] }) {
  return <span aria-hidden="true">{code === "finance" ? "贯" : code === "legal" ? "衡" : "印"}</span>;
}

function getDepartmentCases(cases: ReplyCaseView[] | null, department: DepartmentDirectoryEntry) {
  return cases?.filter((item) => item.departments.includes(department.name)) ?? [];
}

function getMetrics(
  departmentCases: ReplyCaseView[],
  state: MinistriesControllerState["status"],
) {
  if (state === "loading") return [["办结回奏", "读取中"], ["参与卷宗", "读取中"], ["最近回奏", "读取中"]] as const;
  if (state === "error") return [["办结回奏", "暂不可读"], ["参与卷宗", "暂不可读"], ["最近回奏", "暂不可读"]] as const;
  const respondents = new Set(departmentCases.map((item) => item.respondent));
  const latest = departmentCases
    .map((item) => Date.parse(item.repliedAt))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];
  return [
    ["办结回奏", `${departmentCases.length} 件`],
    ["参与官署", `${respondents.size} 处`],
    ["最近回奏", latest ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(latest) : "暂无"],
  ] as const;
}

function MinistryCard({
  department,
  departmentCases,
  index,
  selected,
  state,
  onSelect,
}: {
  department: DepartmentDirectoryEntry;
  departmentCases: ReplyCaseView[];
  index: number;
  selected: boolean;
  state: MinistriesControllerState["status"];
  onSelect(): void;
}) {
  const live = LIVE_DEPARTMENTS.has(department.code);
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
      <span className={live ? styles.liveBadge : styles.pendingBadge}>{live ? "真 · LIVE" : "筹备中"}</span>
      <dl className={styles.cardMetrics}>
        {getMetrics(departmentCases, state).map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <span className={styles.cardRule} aria-hidden="true" />
      <span className={styles.cardStamp} aria-hidden="true">览</span>
    </article>
  );
}

function SelectedMinistryRail({ department, count }: { department: DepartmentDirectoryEntry; count: number }) {
  const live = LIVE_DEPARTMENTS.has(department.code);
  return (
    <aside
      className={styles.selectedMinistryRail}
      data-selected-ministry-rail
      style={{ "--accent": DEV_COLORS[department.code] } as CSSProperties}
      aria-label={`${department.name}属司`}
    >
      <div className={styles.railEyebrow}>{department.name} · OFFICE RAIL</div>
      <div className={styles.railTitle}><span aria-hidden="true" /><div><p>{live ? "真部门" : "筹备中"}</p><h2>{department.name}属司</h2></div></div>
      <div className={styles.railSummary}><span>真实回奏</span><strong>{count}</strong></div>
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
  const casesByDepartment = useMemo(
    () =>
      Object.fromEntries(
        DEPARTMENT_DIRECTORY.map((department) => [department.code, getDepartmentCases(cases, department)]),
      ) as Record<DepartmentDirectoryEntry["code"], ReplyCaseView[]>,
    [cases],
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
          <p>回奏计数来自当前史馆真实 REPLY；礼部按 dev V1 如实标记筹备中。</p>
        </header>
        <div className={styles.canvasViewport} ref={viewportRef}>
          {selected ? <SelectedMinistryRail department={selected} count={casesByDepartment[selected.code].length} /> : null}
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
                departmentCases={casesByDepartment[department.code]}
                index={index}
                selected={selectedCode === department.code}
                state={state}
                onSelect={() => selectMinistry((current) => current === department.code ? null : department.code)}
              />
            ))}
          </div>
        </div>
        {state === "error" ? (
          <div className={`${styles.readError} ${styles.overviewReadError}`} role="alert">
            <span>{error}</span><button type="button" onClick={retry}>重试读取</button>
          </div>
        ) : null}
      </section>
    </ImmersiveCourtShell>
  );
}
