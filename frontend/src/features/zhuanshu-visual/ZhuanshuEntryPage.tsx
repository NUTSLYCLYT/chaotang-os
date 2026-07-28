import Link from "next/link";

import styles from "./ZhuanshuEntryPage.module.css";

const HERO_IMAGE = "/assets/zhuanshu/jinyiwei-hero-v3.png";

export function ZhuanshuEntryPage({ variant }: { variant: "zhuanshu" }) {
  return (
    <section className={styles.page} data-visual-variant={variant} aria-labelledby="zhuanshu-title">
      <div
        className={styles.backdrop}
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        aria-hidden
      />
      <div className={styles.visualStage} aria-hidden />
      <section className={styles.registry} aria-labelledby="zhuanshu-title">
        <div className={styles.registryTitle}>
          <p className={styles.eyebrow}>CHAOTANG OS · IMPERIAL DIRECTORATES</p>
          <h1 id="zhuanshu-title">专署</h1>
          <p className={styles.description}>朝堂外廷专署各守专责。</p>
        </div>
        <Link className={styles.entry} href="/zhuanshu/jinyiwei">
          <span className={styles.emblem} aria-hidden>卫</span>
          <span className={styles.entryCopy}>
            <strong>锦衣卫</strong>
            <small>只读调查台 · 证据汇总与案卷查阅</small>
          </span>
          <span className={styles.enter} aria-hidden>进入 →</span>
        </Link>
        <ul className={styles.shadowOffices} aria-label="其余专署暂未开放">
          <li>太医院</li>
          <li>钦天监</li>
          <li>内务府</li>
          <li>宗人府</li>
        </ul>
      </section>
    </section>
  );
}
