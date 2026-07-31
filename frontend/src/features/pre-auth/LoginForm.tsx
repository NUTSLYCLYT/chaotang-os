"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { submitLogin } from "./formValidation";
import styles from "./preAuth.module.css";
import { createSubmissionGate, type SubmissionGate } from "./submissionGate";

export function LoginForm() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite") ?? "";
  const next = searchParams.get("next");
  const registered = searchParams.get("registered") === "1";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionGate = useRef<SubmissionGate | null>(null);
  if (submissionGate.current === null) {
    submissionGate.current = createSubmissionGate(setSubmitting);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = submissionGate.current?.run(() => submitLogin({ username, password }, next));
    if (!request) {
      return;
    }

    const result = await request;
    if (result.ok) {
      window.location.assign(result.destination);
      return;
    }
    setMessage(result.message);
  }

  return <><p className={styles.eyebrow}>COURTOS ENTRY</p><h2>账号验证</h2><p className={styles.panelLead}>仅限已注册用户登录。</p>
    {inviteCode ? <p className={styles.context}>引荐邀请码：{inviteCode}</p> : null}
    {registered ? <p className={`${styles.message} ${styles.success}`} role="status">注册成功，请登录</p> : null}
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>账号或邮箱<input className={styles.input} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
      <label className={styles.field}>密码<input className={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      {message ? <p className={`${styles.message} ${styles.error}`} role="alert">{message}</p> : null}
      <button className={styles.button} type="submit" disabled={submitting}>
        {submitting ? "正在入朝…" : "进入上书房"}
      </button>
    </form></>;
}
