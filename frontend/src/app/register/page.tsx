import Link from "next/link";
import { Suspense } from "react";

import { PreAuthShell } from "@/features/pre-auth/PreAuthShell";
import { RegisterForm } from "@/features/pre-auth/RegisterForm";

export default function RegisterPage() {
  return (
    <PreAuthShell
      eyebrow="Register"
      title="注册新账号"
      description="创建你的朝堂席位，体验群臣协同工作。"
      footer={<>已有账号？<Link href="/login">直接登录</Link></>}
    >
      <Suspense fallback={<p>正在准备注册表单…</p>}><RegisterForm /></Suspense>
    </PreAuthShell>
  );
}
