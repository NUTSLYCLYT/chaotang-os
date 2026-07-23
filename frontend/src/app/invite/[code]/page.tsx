import Link from "next/link";

import { PreAuthShell } from "@/features/pre-auth/PreAuthShell";
import { normalizeInviteCode } from "@/features/pre-auth/formValidation";
import styles from "@/features/pre-auth/preAuth.module.css";

export default async function InviteLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeInviteCode(rawCode);
  const registerHref = `/register?invite=${encodeURIComponent(code)}`;
  const loginHref = `/login?invite=${encodeURIComponent(code)}`;

  return <PreAuthShell eyebrow="Invitation" title="引荐令已送达" description="此页面仅展示链接中的引荐码；尚未接入验证、授权或账号服务。" footer={<Link href="/invite">改用其他邀请码</Link>}>
    <p className={styles.eyebrow}>IMPERIAL INVITATION</p><h2>入朝引荐</h2><p className={styles.panelLead}>请确认你希望继续访问的登录前页面。</p>
    <p className={styles.context}>{code || "未提供邀请码"}</p>
    <div className={styles.actions}><Link className={styles.link} href={registerHref}>携带邀请码注册 →</Link><Link className={styles.link} href={loginHref}>前往登录 →</Link></div>
  </PreAuthShell>;
}
