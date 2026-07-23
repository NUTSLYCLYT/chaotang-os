import Link from "next/link";
import { Suspense } from "react";

import { EnterContent } from "@/features/pre-auth/EnterContent";
import { PreAuthShell } from "@/features/pre-auth/PreAuthShell";

export default function EnterPage() {
  return (
    <PreAuthShell
      eyebrow="Entry"
      title="恭候入朝"
      description="朝堂入口目前只提供登录前界面展示，不会核验令牌或自动跳转。"
      footer={<Link href="/invite">我有邀请码</Link>}
    >
      <Suspense fallback={<p>正在准备入朝入口…</p>}><EnterContent /></Suspense>
    </PreAuthShell>
  );
}
