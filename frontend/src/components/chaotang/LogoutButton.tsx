"use client";

import { useState } from "react";

import styles from "./ChaotangHeader.module.css";
import { logoutAction } from "./logoutAction";

type LogoutStatus = "idle" | "pending" | "error";

export function LogoutButton({ className }: { className?: string }) {
  const [status, setStatus] = useState<LogoutStatus>("idle");
  const label = status === "pending" ? "退出中…" : status === "error" ? "重试退出" : "退出";

  async function submitLogout() {
    if (status === "pending") return;
    setStatus("pending");
    if (!await logoutAction()) setStatus("error");
  }

  return (
    <span className={styles.logoutControl} aria-live="polite">
      <button
        className={className}
        type="button"
        disabled={status === "pending"}
        aria-busy={status === "pending"}
        onClick={submitLogout}
      >
        {label}
      </button>
      {status === "error" ? <span className={styles.logoutError} role="alert">退出失败，请重试</span> : null}
    </span>
  );
}
