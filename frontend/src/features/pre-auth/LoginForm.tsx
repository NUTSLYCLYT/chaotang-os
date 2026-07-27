"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { submitLogin } from "./formValidation";
import styles from "./preAuth.module.css";

export function LoginForm() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite") ?? "";
  const next = searchParams.get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await submitLogin({ username, password }, next);
    if (result.ok) {
      window.location.assign(result.destination);
      return;
    }
    setMessage(result.message);
  }

  return <><p className={styles.eyebrow}>COURTOS ENTRY</p><h2>账号验证</h2><p className={styles.panelLead}>仅限已注册用户登录。</p>
    {inviteCode ? <p className={styles.context}>引荐邀请码：{inviteCode}</p> : null}
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>用户名<input className={styles.input} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
      <label className={styles.field}>密码<input className={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      {message ? <p className={`${styles.message} ${styles.error}`} role="alert">{message}</p> : null}
      <button className={styles.button} type="submit">入朝议政</button>
    </form></>;
}
