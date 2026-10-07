import Link from "next/link";
import { useState, type CSSProperties } from "react";

import { formatBusinessTime } from "../../lib/formatBusinessTime";
import type { ReplyCaseView } from "../court-replies/replyFeed";
import { CourtCapabilityButton } from "../court-visuals/CourtCapabilityButton";
import { ImmersiveCourtShell } from "../court-visuals/ImmersiveCourtShell";
import {
  DEPARTMENT_DIRECTORY,
  type DepartmentDirectoryEntry,
  type OfficeDirectoryEntry,
} from "./departmentDirectory";
import { DepartmentEdictStage, DepartmentRailPanel } from "./DepartmentVisualPrimitives";
import type { MinistriesControllerState } from "./ministriesController";
import { projectMinistryReplies } from "./ministriesViewModel";
import styles from "./ministries.module.css";

export function OfficeScene({
  department,
  office,
  cases,
  state,
  error,
  retry,
}: {
  department: DepartmentDirectoryEntry;
  office: OfficeDirectoryEntry;
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
  const [selectedReplyId, selectReply] = useState<string | null>(null);
  const selectedReply =
    departmentCases.find((item) => item.id === selectedReplyId) ?? departmentCases[0] ?? null;

  return (
    <ImmersiveCourtShell
      currentLabel={office.name}
      currentPath={`/liubu/${department.code}/${office.slug}`}
      backgroundImage={department.background}
      scene="liubu"
      hideScrollbar
    >
      <article
        className={styles.departmentWorkspace}
        style={{ "--accent": department.accent } as CSSProperties}
        data-view-state={replyView.status}
      >
        <div className={styles.departmentStatusBar} data-office-status-bar>
          <span className={styles.departmentStatusWho}>
            <i aria-hidden="true" />
            <strong>{department.name} / {office.name}</strong>
            <em>司级办事台</em>
          </span>
          <span className={styles.departmentStatusSep} aria-hidden="true" />
          <span className={styles.departmentStatusStat}>
            <b>{office.responsibilities.length}</b>本司职掌
          </span>
          <span className={styles.departmentStatusStat}>
            <b>{replyView.countLabel}</b>部门回奏
          </span>
          <span className={styles.departmentStatusSource}>数据源 · 当前用户史馆 REPLY</span>
        </div>
        <header className={styles.departmentPageHeader}>
          <div>
            <div className={styles.departmentBreadcrumb}>
              <Link href="/liubu">六部</Link><span>/</span>
              <Link href={`/liubu/${department.code}`}>{department.name}</Link><span>/</span>
              <b>{office.name}</b>
            </div>
            <p>司级办事台</p>
            <h1>{office.name}</h1>
            <span>先看部门真实回奏，再判断证据边界与下一步。</span>
          </div>
          <nav className={styles.departmentNavigation} data-department-navigation aria-label="六部导航">
            {DEPARTMENT_DIRECTORY.map((item) => (
              <Link href={`/liubu/${item.code}`} key={item.code} data-current={item.code === department.code || undefined}>
                {item.name}
              </Link>
            ))}
          </nav>
        </header>

        <div className={styles.departmentThreeAxis} data-office-three-columns>
          <aside data-left-rail aria-labelledby="office-duties-heading">
            <DepartmentRailPanel title={`${office.name}左批`} subtitle="职责、边界与同部各司">
              <h2 className={styles.departmentSectionTitle} id="office-duties-heading">本司职掌</h2>
              <ul className={styles.departmentDutyList}>
                {office.responsibilities.map((responsibility) => <li key={responsibility}>{responsibility}</li>)}
              </ul>
              <p className={styles.departmentBoundary}>这些职责不是实时任务、工作量、裁决或办理状态。</p>
              <nav className={styles.officeNavigation} data-office-navigation aria-label={`${department.name}各司导航`}>
                {department.offices.map((item) => (
                  <Link href={`/liubu/${department.code}/${item.slug}`} key={item.slug} data-current={item.slug === office.slug || undefined}>
                    {item.name}
                  </Link>
                ))}
              </nav>
              <section
                className={styles.departmentOpinionNotice}
                data-office-opinion-state="not-recorded"
                aria-labelledby="opinion-heading"
              >
                <h2 id="opinion-heading">逐司明细未记录</h2>
                <p>当前回奏归档只保存参与部门、处理路径与结论，未记录本司明细，不能据此推断本司意见。</p>
              </section>
            </DepartmentRailPanel>
          </aside>

          <section data-central-memorial aria-labelledby="office-memorial-heading">
            <span className={styles.departmentSrOnly} id="office-memorial-heading">{office.name}中央奏折</span>
            <DepartmentEdictStage
              titleId="office-edict-title"
              kicker={`${department.name}奏 · 司级办事台`}
              title={selectedReply?.title ?? `${office.name}待命`}
              subtitle={
                replyView.status === "loading"
                  ? "正在读取史馆回奏"
                  : replyView.status === "error"
                    ? "史馆回奏暂不可读"
                    : selectedReply
                      ? "真实部门参与记录"
                      : "史馆读取完成 · 暂无部门回奏"
              }
              footer={office.actions.map((action) => (
                <CourtCapabilityButton
                  capability="unavailable"
                  explanation={`“${action}”尚无司级写入能力；当前不会执行、派发或形成意见。`}
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
                <dl className={styles.edictFacts}>
                  <div><dt>部门回奏结论</dt><dd>{selectedReply.conclusion}</dd></div>
                  <div><dt>部门处理路径</dt><dd>{selectedReply.process}</dd></div>
                  <div><dt>回奏人</dt><dd>{selectedReply.respondent}</dd></div>
                  <div><dt>回奏时间</dt><dd><time dateTime={selectedReply.repliedAt}>{formatBusinessTime(selectedReply.repliedAt)}</time></dd></div>
                </dl>
              ) : null}
              {replyView.status === "empty" ? (
                <div className={styles.edictEmpty}>
                  <p className={styles.edictEmptyMark}>{office.name.slice(0, 1)}</p>
                  <h3>{office.name}</h3>
                  <p>没有可展示的真实部门回奏；不会生成本司意见。</p>
                </div>
              ) : null}
              <p className={styles.departmentBoundary}>本奏折只展示{department.name}参与记录，不归属或映射到{office.name}。</p>
            </DepartmentEdictStage>
          </section>

          <aside data-right-rail aria-labelledby="office-context-heading">
            <DepartmentRailPanel
              title={`${office.name}右批`}
              subtitle={replyView.countLabel}
            >
              <h2 className={styles.departmentSectionTitle} id="office-context-heading">部门回奏上下文</h2>
              <p className={styles.departmentBoundary}>以下记录不代表{office.name}意见。</p>
              {replyView.status === "loading" ? <div className={styles.departmentLoading}>正在调取史馆真实回奏…</div> : null}
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
          <span>数据来源 · 当前用户史馆 REPLY</span><span>逐司意见未记录 · 保守展示</span>
        </footer>
      </article>
    </ImmersiveCourtShell>
  );
}
