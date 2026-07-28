import Link from "next/link";
import { useState, type CSSProperties } from "react";

import type { ReplyCaseView } from "../court-replies/replyFeed";
import { CourtCapabilityButton } from "../court-visuals/CourtCapabilityButton";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import {
  DEPARTMENT_ACTIONS,
  DEPARTMENT_DIRECTORY,
  type DepartmentDirectoryEntry,
} from "./departmentDirectory";
import { DepartmentEdictStage, DepartmentRailPanel } from "./DepartmentVisualPrimitives";
import type { MinistriesControllerState } from "./ministriesController";
import { projectMinistryReplies } from "./ministriesViewModel";
import styles from "./ministries.module.css";

export function DepartmentScene({
  department,
  cases,
  state,
  error,
  retry,
}: {
  department: DepartmentDirectoryEntry;
  cases: ReplyCaseView[] | null;
  state: MinistriesControllerState["status"];
  error: string | null;
  retry(): void;
}) {
  const replyView = projectMinistryReplies({
    state,
    cases,
    error,
    department: department.name,
  });
  const departmentCases = replyView.cases ?? [];
  const [selectedOfficeSlug, selectOffice] = useState(department.offices[0]?.slug ?? "");
  const [selectedReplyId, selectReply] = useState<string | null>(null);
  const selectedOffice =
    department.offices.find((office) => office.slug === selectedOfficeSlug) ?? department.offices[0];
  const selectedReply =
    departmentCases.find((item) => item.id === selectedReplyId) ?? departmentCases[0] ?? null;

  return (
    <ImmersiveCourtShell
      currentLabel={department.name}
      currentPath={`/liubu/${department.code}`}
      backgroundImage={department.background}
      scene="liubu"
      hideScrollbar
    >
      <div
        className={styles.departmentWorkspace}
        style={{ "--accent": department.accent } as CSSProperties}
        data-view-state={replyView.status}
      >
        <header className={styles.departmentPageHeader}>
          <div>
            <Link href="/liubu">← 六部</Link>
            <p>DEPARTMENT VIEW</p>
            <h1>{department.name}</h1>
            <span>先选下属专司，再看真实回奏与职责边界；静态职责不表示实时状态、负载或已形成意见。</span>
          </div>
          <nav className={styles.departmentNavigation} data-department-navigation aria-label="六部导航">
            {DEPARTMENT_DIRECTORY.map((item) => (
              <Link href={`/liubu/${item.code}`} key={item.code} data-current={item.code === department.code || undefined}>
                {item.name}
              </Link>
            ))}
          </nav>
        </header>

        <div className={styles.departmentThreeAxis} data-department-three-columns>
          <aside data-left-rail aria-labelledby="department-offices-heading">
            <DepartmentRailPanel title={`${department.name}各司`} subtitle={`先选下属专司 · 共 ${department.offices.length} 司`}>
              <ul className={styles.departmentRailList} data-office-navigation>
                {department.offices.map((office) => (
                  <li key={office.slug} data-selected={selectedOffice?.slug === office.slug || undefined}>
                    <button type="button" onClick={() => selectOffice(office.slug)}>
                      <strong>{office.name}</strong>
                      <span>{office.responsibilities.join(" · ")}</span>
                    </button>
                    <Link href={`/liubu/${department.code}/${office.slug}`} aria-label={`进入${office.name}`}>进入</Link>
                  </li>
                ))}
              </ul>
            </DepartmentRailPanel>
          </aside>

          <section data-central-memorial aria-labelledby="department-memorial-heading">
            <span className={styles.departmentSrOnly} id="department-memorial-heading">{department.name}中央奏折</span>
            <DepartmentEdictStage
              titleId="department-edict-title"
              kicker={`${department.name}奏 · 六部案卷`}
              title={selectedReply?.title ?? `${selectedOffice?.name ?? department.name}职掌`}
              subtitle={
                replyView.status === "loading"
                  ? "正在读取史馆回奏"
                  : replyView.status === "error"
                    ? "史馆回奏暂不可读"
                    : selectedReply
                      ? "真实部门回奏"
                      : "权威静态职责 · 非实时案卷"
              }
              footer={DEPARTMENT_ACTIONS[department.code].map((action) => (
                <CourtCapabilityButton
                  capability="unavailable"
                  explanation={`“${action}”尚无可用业务能力；当前页面不会执行或写入。`}
                  key={action}
                >
                  {action}
                </CourtCapabilityButton>
              ))}
            >
              {replyView.status === "loading" ? (
                <div className={styles.edictReadState} aria-live="polite">
                  正在调取史馆真实回奏；读取完成前不显示空记录或计数。
                </div>
              ) : null}
              {replyView.status === "error" ? (
                <div className={styles.departmentReadError} role="alert">
                  <span>{replyView.error}</span>
                  <button type="button" onClick={retry}>重试读取</button>
                </div>
              ) : null}
              {replyView.status === "ready" && selectedReply ? (
                <>
                  <dl className={styles.edictFacts}>
                    <div><dt>回奏结论</dt><dd>{selectedReply.conclusion}</dd></div>
                    <div><dt>处理路径</dt><dd>{selectedReply.process}</dd></div>
                    <div><dt>回奏人</dt><dd>{selectedReply.respondent}</dd></div>
                    <div><dt>回奏时间</dt><dd>{selectedReply.repliedAt}</dd></div>
                  </dl>
                  <p className={styles.departmentBoundary}>这是{department.name}参与记录，不代表任一司已形成意见。</p>
                </>
              ) : null}
              {replyView.status === "empty" ? (
                <div className={styles.edictEmpty}>
                  <p className={styles.edictEmptyMark}>{department.name.slice(0, 1)}</p>
                  <h3>{selectedOffice?.name}</h3>
                  <p>{selectedOffice?.responsibilities.join("、")}</p>
                  <span>当前没有真实回奏可展示；不会以静态职责补造案卷。</span>
                </div>
              ) : null}
            </DepartmentEdictStage>
          </section>

          <aside data-right-rail aria-labelledby="department-replies-heading">
            <DepartmentRailPanel
              title="真实回奏案卷"
              subtitle={replyView.countLabel}
            >
              {replyView.status === "loading" ? <div className={styles.departmentLoading} aria-live="polite">正在调取史馆真实回奏…</div> : null}
              {replyView.status === "error" ? (
                <div className={styles.departmentReadError} role="alert">
                  <span>{replyView.error}</span><button type="button" onClick={retry}>重试读取</button>
                </div>
              ) : null}
              {replyView.status === "empty" ? (
                <p className={styles.departmentEmpty}>当前未读取到本部参与的真实回奏。</p>
              ) : null}
              {replyView.status === "ready" ? (
                <ul className={styles.departmentRailList}>
                  {departmentCases.map((item) => (
                    <li key={item.id} data-selected={selectedReply?.id === item.id || undefined}>
                      <button type="button" onClick={() => selectReply(item.id)}>
                        <strong>{item.title}</strong><span>{item.conclusion}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </DepartmentRailPanel>
          </aside>
        </div>
        <footer className={styles.departmentIntegrity}>
          <span>数据来源 · 当前用户史馆 REPLY</span><span>只读 · 不推断逐司意见</span>
        </footer>
      </div>
    </ImmersiveCourtShell>
  );
}
