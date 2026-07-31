import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/features/pre-auth/LoginForm";
import { PreAuthShell } from "@/features/pre-auth/PreAuthShell";

export default function LoginPage() {
  return (
    <PreAuthShell
      eyebrow="景和朝 · 多用户朝堂"
      title="重入朝堂，续理万机"
      description="登录后只进入属于您的独立朝堂；案卷、Agent 轨迹与史馆归档彼此隔离。"
      footer={<Link href="/register">尚未创建朝堂？注册</Link>}
    >
      <Suspense fallback={<p>正在准备登录表单…</p>}><LoginForm /></Suspense>
    </PreAuthShell>
  );
}
