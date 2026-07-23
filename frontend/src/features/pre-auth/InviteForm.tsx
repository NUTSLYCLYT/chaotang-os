"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { normalizeInviteCode } from "./formValidation";
import styles from "./preAuth.module.css";

export function InviteForm() {
  const codeFromUrl = useSearchParams().get("code") ?? "";
  const [code, setCode] = useState(() => normalizeInviteCode(codeFromUrl));
  const [message, setMessage] = useState<string | null>(null);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(code ? "邀请码已记录在当前页面；验证服务尚未接入。" : "请输入邀请码。");
  }
  return <><p className={styles.eyebrow}>COURTOS · INVITATION</p><h2>呈上引荐码</h2><p className={styles.panelLead}>请使用获赠的邀请码继续浏览注册界面。</p>
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>邀请码<input className={styles.codeInput} value={code} onChange={(event) => setCode(normalizeInviteCode(event.target.value))} placeholder="例如 COURT2026" autoComplete="off" required /></label>
      {message ? <p className={message === "请输入邀请码。" ? `${styles.message} ${styles.error}` : styles.message} role="status">{message}</p> : null}
      <button className={styles.button} type="submit">记录邀请码</button>
    </form>
    {code ? <p className={styles.actions}><Link className={styles.link} href={`/register?invite=${encodeURIComponent(code)}`}>携带此码前往注册 →</Link></p> : null}</>;
}
