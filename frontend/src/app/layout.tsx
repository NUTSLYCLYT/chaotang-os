import type { Metadata } from 'next';
import { ToastHost } from '@/components/ui/toast-host';
import { NetworkBanner } from '@/components/ui/network-banner';
import { SealStampOverlay } from '@/features/shared/components/imperial-seal-stamp';
import { ArchiveCeremonyOverlay } from '@/features/shared/components/archive-ceremony';
import { CourtOnboarding } from '@/features/shared/components/court-onboarding';
import { AuthGate } from '@/components/AuthGate';
import { WsEventBridge } from '@/components/WsEventBridge';
import './globals.css';

/**
 * 字体策略（2026-05-02 改）：
 *
 * 移除 `next/font/google` —— 它要求 build 时能访问 fonts.googleapis.com / gstatic.com，
 * 在国内 prod 环境/受限网络中会卡死（Turbopack 无法解析 @font-face URL；
 * Webpack 模式下多 weight 走代理时各自排队超时）。
 *
 * 现状：
 *   - globals.css 注册了 public/fonts/NotoSansSC-VF.ttf / NotoSerifSC-VF.ttf 自托管入口。
 *   - Docker runtime 安装 font-noto-cjk，避免 Alpine 容器出现中文 tofu 方框。
 *   - fallback 链仍覆盖 macOS / Windows / Linux：Noto / PingFang / 雅黑 / SimSun。
 *
 * 升级路径：把精简后的 Noto Sans SC / Noto Serif SC 字体落到 public/fonts/，
 * 即可拿到完全自托管 + 无网络依赖的中文渲染。
 */

export const metadata: Metadata = {
  title: '朝堂 OS · CourtOS V2',
  description: '以丞相为中枢、以六部为执行、以锦衣卫为情报网的企业级 Agent 指挥系统',
  applicationName: 'CourtOS V2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="min-h-screen antialiased">
        <NetworkBanner />
        {/* 全局 UserMenu 已移除 — dashboard ChaotangTopNav 自带用户/退出按钮, 浮层冗余且会盖在 /manors 等沉浸页上 */}
        <AuthGate>{children}</AuthGate>
        <WsEventBridge />
        <ToastHost />
        {/* 全站玺印落印动画 · 任何批示都会触发 */}
        <SealStampOverlay />
        {/* 全站归档庆典 · 任务完成时金花撒落 */}
        <ArchiveCeremonyOverlay />
        {/* 60 秒首次引导 · 只触发一次 */}
        <CourtOnboarding />
      </body>
    </html>
  );
}
