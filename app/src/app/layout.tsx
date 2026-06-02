import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "パソコン教室 予約管理",
  description: "パソコン教室の予約管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
