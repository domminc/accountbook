import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "가계부",
  description: "부부가 함께 쓰는 가계부",
  appleWebApp: { capable: true, title: "가계부", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08080b",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 기본은 다크. 설정 > 화면 테마에서 고른 값 (라이트·기기 설정)
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="ko" data-theme={theme} className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
