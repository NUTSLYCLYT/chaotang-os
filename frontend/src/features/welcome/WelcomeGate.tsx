"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import styles from "./welcome.module.css";
import { nextWelcomePhase, type WelcomePhase } from "./welcomeTransition";

export function WelcomeGate() {
  const router = useRouter();
  const [phase, setPhase] = useState<WelcomePhase>("closed");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (phase !== "opening") return;

    void videoRef.current?.play().catch(() => {
      router.replace("/login");
    });
  }, [phase, router]);

  function attendCourt() {
    setPhase((current) => nextWelcomePhase(current, "attend"));
  }

  function completeOpening() {
    router.replace("/login");
  }

  return (
    <main className={styles.page}>
      <div className={styles.scene} aria-hidden="true">
        {phase === "closed" && <div className={`${styles.backdrop} ${styles.closed}`} />}
        {phase === "opening" && (
          <video
            ref={videoRef}
            className={styles.backgroundVideo}
            src="/assets/v5-pre-auth/welcome-gate-opening.mp4"
            aria-hidden="true"
            tabIndex={-1}
            draggable={false}
            playsInline
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            onEnded={completeOpening}
            onError={completeOpening}
          />
        )}
      </div>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          朝堂 OS
        </Link>
        <Link href="/login" className={styles.skip}>
          跳过仪式 〉
        </Link>
      </header>
      <section className={styles.hero} aria-labelledby="welcome-title">
        <h1 id="welcome-title">启 朝</h1>
        <p>朕只需下一道旨，群臣 Agent 自会办结</p>
      </section>
      <nav className={styles.actions} aria-label="朝堂入口">
        <button
          type="button"
          className={styles.attend}
          disabled={phase !== "closed"}
          onClick={attendCourt}
        >
          上朝
        </button>
        <Link href="/login" className={styles.login}>已有朝堂？登录</Link>
      </nav>
    </main>
  );
}
