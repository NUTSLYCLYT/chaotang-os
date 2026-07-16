import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "chaotang-os",
  description: "最小前端骨架入口，仅用于验证前后端联通，不承载业务功能。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
