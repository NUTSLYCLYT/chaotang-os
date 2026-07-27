import Link from "next/link";
import type { CSSProperties } from "react";

import type { DepartmentDemo, DepartmentOfficeDemo } from "./departmentDemoData";
import styles from "./departmentDemo.module.css";

function demoBackground(department: DepartmentDemo): CSSProperties {
  return {
    "--department-accent": department.accent,
    backgroundImage: `url("${department.background}")`,
  } as CSSProperties;
}

export function MinistryOverview({ departments }: { departments: readonly DepartmentDemo[] }) {
  return (
    <main className={styles.overview}>
      <div className={styles.intro}>
        <p className={styles.demoLabel}>演示展示</p>
        <p className={styles.kicker}>SIX MINISTRIES</p>
        <h1>六部政务分域</h1>
        <p>以下为静态场景与信息层级展示，不代表实时业务数据或处理状态。</p>
      </div>
      <section className={styles.ministryGrid} aria-label="六部演示入口">
        {departments.map((department) => (
          <Link className={styles.ministryCard} href={`/liubu/${department.code}`} key={department.code} style={demoBackground(department)}>
            <span className={styles.cardShade} />
            <span className={styles.cardContent}>
              <small>{department.titleEn}</small>
              <strong>{department.name}</strong>
              <span>{department.summary}</span>
              <em>进入演示场景 →</em>
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}

export function DepartmentOverview({ department }: { department: DepartmentDemo }) {
  return (
    <main className={styles.department} style={demoBackground(department)}>
      <div className={styles.pageShade} />
      <div className={styles.departmentContent}>
        <p className={styles.demoLabel}>演示展示 · 静态内容</p>
        <Link className={styles.backLink} href="/liubu">← 返回六部</Link>
        <p className={styles.kicker}>{department.titleEn}</p>
        <h1>{department.name}</h1>
        <p className={styles.summary}>{department.summary}</p>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><p>属署布局</p><span>{department.offices.length} 司</span></div>
          <div className={styles.officeGrid}>
            {department.offices.map((office) => (
              <Link className={styles.officeCard} href={`/liubu/${department.code}/${office.code}`} key={office.code}>
                <small>{office.focus}</small><strong>{office.name}</strong><span>{office.duty}</span><em>查看属署说明 →</em>
              </Link>
            ))}
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><p>演示待办</p><span>DEMO</span></div>
          <ul className={styles.taskList}>{department.demoTasks.map((task, index) => <li key={task}><b>0{index + 1}</b>{task}<span>演示</span></li>)}</ul>
        </section>
      </div>
    </main>
  );
}

export function DepartmentOfficeView({ department, office }: { department: DepartmentDemo; office: DepartmentOfficeDemo }) {
  return (
    <main className={styles.department} style={demoBackground(department)}>
      <div className={styles.pageShade} />
      <article className={styles.officeDetail}>
        <p className={styles.demoLabel}>演示展示 · 静态内容</p>
        <Link className={styles.backLink} href={`/liubu/${department.code}`}>← 返回{department.name}</Link>
        <p className={styles.kicker}>{department.name} · {department.titleEn}</p>
        <h1>{office.name}</h1>
        <p className={styles.summary}>{office.duty}</p>
        <dl className={styles.detailList}>
          <div><dt>展示重点</dt><dd>{office.focus}</dd></div>
          <div><dt>页面性质</dt><dd>视觉演示，不含实时数据、操作入口或处理状态。</dd></div>
          <div><dt>所属部门</dt><dd>{department.name}（{department.titleEn}）</dd></div>
        </dl>
      </article>
    </main>
  );
}
