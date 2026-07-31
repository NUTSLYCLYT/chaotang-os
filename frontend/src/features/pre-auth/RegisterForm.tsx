"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { submitRegister } from "./formValidation";
import styles from "./preAuth.module.css";
import { createSubmissionGate, type SubmissionGate } from "./submissionGate";

export function RegisterForm() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite") ?? "";
  const next = searchParams.get("next");
  const [username, setUsername] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionGate = useRef<SubmissionGate | null>(null);
  if (submissionGate.current === null) {
    submissionGate.current = createSubmissionGate(setSubmitting);
  }
  const loginHref = inviteCode ? `/login?invite=${encodeURIComponent(inviteCode)}` : "/login";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = submissionGate.current?.run(() => submitRegister({ username, email, password, confirm }, next));
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

  return <><p className={styles.eyebrow}>CREATE ACCOUNT</p><h2>建立朝堂席位</h2><p className={styles.panelLead}>完善资料后即可进入朝堂。</p>
    {inviteCode ? <p className={styles.context}>引荐邀请码：{inviteCode}</p> : null}
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>用户名<input className={styles.input} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="2–32 个中英文字符" required /></label>
      <label className={styles.field}>邮箱<input className={styles.input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@courtos.ai" required /></label>
      <label className={styles.field}>密码<input className={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="至少 6 位" required /></label>
      <label className={styles.field}>确认密码<input className={styles.input} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" placeholder="再次输入密码" required /></label>
      {message ? <p className={`${styles.message} ${styles.error}`} role="alert">{message}</p> : null}
      <button className={styles.button} type="submit" disabled={submitting}>
        {submitting ? "正在创建…" : "创建朝堂"}
      </button>
    </form>
    <p className={styles.actions}><Link className={styles.link} href={loginHref}>改为登录 →</Link></p></>;
}
