import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "朝堂 OS · CourtOS V2",
  description: "以丞相为中枢、以六部为执行的企业智能协同系统。",
  applicationName: "CourtOS V2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
