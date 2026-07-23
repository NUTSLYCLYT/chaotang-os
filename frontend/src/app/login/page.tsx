import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/features/pre-auth/LoginForm";
import { PreAuthShell } from "@/features/pre-auth/PreAuthShell";

export default function LoginPage() {
  return (
    <PreAuthShell
      eyebrow="Login"
      title="登入朝堂"
      description="进入大殿查看朝堂态势。"
      footer={<><Link href="/register">尚无账号？注册席位</Link>　·　<Link href="/invite">持有邀请码？</Link></>}
    >
      <Suspense fallback={<p>正在准备登录表单…</p>}><LoginForm /></Suspense>
    </PreAuthShell>
  );
}
