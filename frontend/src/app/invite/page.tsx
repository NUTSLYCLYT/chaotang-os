import Link from "next/link";
import { Suspense } from "react";

import { InviteForm } from "@/features/pre-auth/InviteForm";
import { PreAuthShell } from "@/features/pre-auth/PreAuthShell";

export default function InvitePage() {
  return (
    <PreAuthShell
      eyebrow="Invitation"
      title="入朝引荐"
      description="输入引荐码以携带至注册页面。邀请码只在当前页面展示，不会被验证或保存。"
      footer={<>已有账号？<Link href="/login">直接登录</Link></>}
    >
      <Suspense fallback={<p>正在准备邀请码表单…</p>}><InviteForm /></Suspense>
    </PreAuthShell>
  );
}
