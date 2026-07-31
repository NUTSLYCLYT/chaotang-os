import Link from "next/link";
import { Suspense } from "react";

import { PreAuthShell } from "@/features/pre-auth/PreAuthShell";
import { RegisterForm } from "@/features/pre-auth/RegisterForm";

export default function RegisterPage() {
  return (
    <PreAuthShell
      eyebrow="景和朝 · 新朝堂登记"
      title="创建朝堂，开启万机"
      description="注册后将拥有彼此隔离的案卷、Agent 轨迹与史馆归档，安心开始您的数字朝堂。"
      footer={<>已有朝堂？<Link href="/login">直接登录</Link></>}
    >
      <Suspense fallback={<p>正在准备注册表单…</p>}><RegisterForm /></Suspense>
    </PreAuthShell>
  );
}
