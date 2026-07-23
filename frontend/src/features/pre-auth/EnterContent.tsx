"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import styles from "./preAuth.module.css";

export function EnterContent() {
  const token = useSearchParams().get("token");
  const message = token ? "引荐令牌已收到；认证服务尚未接入。" : "请通过登录或邀请码进入朝堂。";
  return <><p className={styles.eyebrow}>COURTOS ENTRY</p><h2>{token ? "令牌已呈递" : "选择入朝方式"}</h2><p className={styles.panelLead}>{message}</p>
    <p className={styles.message}>{token ? "令牌仅用于显示当前提示，不会被验证或保存。" : "登录和邀请码页面均保留本地表单交互。"}</p>
    <p className={styles.actions}><Link className={styles.link} href="/login">前往登录 →</Link></p></>;
}
