import styles from "./CourtPlaceholderPage.module.css";

type CourtVisualVariant = "dadian" | "junjichu" | "liubu" | "zhuanshu";

export function CourtPlaceholderPage({ title, description, routeSegment, variant = "zhuanshu" }: {
  title: string;
  description: string;
  routeSegment?: string;
  variant?: CourtVisualVariant;
}) {
  return (
    <section className={`${styles.page} ${styles[variant]}`} data-court-placeholder>
      <div className={styles.rule} aria-hidden />
      <p className={styles.eyebrow}>朝堂事务 · 视觉入口</p>
      <h1>{title}</h1>
      <p className={styles.description}>{description}</p>
      <article className={styles.card}>
        <span>功能筹备中</span>
        <p>此入口已纳入受保护的朝堂页面壳，业务功能将沿用当前工程的认证与服务端契约逐步接入。</p>
        {routeSegment ? <code>路由：{routeSegment}</code> : null}
      </article>
    </section>
  );
}
