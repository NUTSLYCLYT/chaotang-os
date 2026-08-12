"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";

import styles from "./welcome.module.css";
import { initialWelcomeState, nextWelcomeState } from "./welcomeTransition";

const WELCOME_FALLBACK_MS = 4_000;

export function WelcomeGate() {
  const router = useRouter();
  const [state, dispatch] = useReducer(nextWelcomeState, initialWelcomeState);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigationStartedRef = useRef(false);

  const enterLogin = useCallback(() => {
    if (navigationStartedRef.current) return;
    navigationStartedRef.current = true;
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      dispatch({ type: "media-ready" });
    }
  }, []);

  useEffect(() => {
    if (state.phase !== "waiting") return;

    const fallback = window.setTimeout(() => dispatch({ type: "timeout" }), WELCOME_FALLBACK_MS);
    return () => window.clearTimeout(fallback);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "finished") enterLogin();
  }, [enterLogin, state.phase]);

  useEffect(() => {
    if (state.phase !== "opening") return;

    const video = videoRef.current;
    if (!video) {
      enterLogin();
      return;
    }
    video.currentTime = 0;
    void video.play().catch(enterLogin);
  }, [enterLogin, state.phase]);

  function attendCourt() {
    if (state.attendRequested) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      enterLogin();
      return;
    }
    dispatch({ type: "attend" });
  }

  function markMediaReady() {
    dispatch({ type: "media-ready" });
  }

  function completeOpening() {
    dispatch({ type: "complete" });
  }

  function failOpening() {
    dispatch({ type: "media-error" });
  }

  return (
    <main className={styles.page}>
      <div className={styles.scene} aria-hidden="true">
        {state.phase !== "opening" && <div className={`${styles.backdrop} ${styles.closed}`} />}
        <video
          ref={videoRef}
          className={`${styles.backgroundVideo} ${state.phase === "opening" ? styles.videoVisible : styles.videoPreloading}`}
          src="/assets/v5-pre-auth/welcome-gate-opening.mp4"
          aria-hidden="true"
          tabIndex={-1}
          draggable={false}
          playsInline
          preload="auto"
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          onCanPlay={markMediaReady}
          onEnded={completeOpening}
          onError={failOpening}
        />
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
          onClick={attendCourt}
        >
          {state.phase === "waiting" ? "宫门准备中…" : "上朝"}
        </button>
        <Link href="/login" className={styles.login}>已有朝堂？登录</Link>
      </nav>
    </main>
  );
}
