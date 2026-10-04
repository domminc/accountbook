import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { DESIGN_COOKIE, THEME_COOKIE, parseDesign, parseTheme, themeColor } from "@/lib/theme";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "가계부",
  description: "부부가 함께 쓰는 가계부",
  appleWebApp: { capable: true, title: "가계부", statusBarStyle: "black" },
};

export async function generateViewport(): Promise<Viewport> {
  const jar = await cookies();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: themeColor(parseDesign(jar.get(DESIGN_COOKIE)?.value), parseTheme(jar.get(THEME_COOKIE)?.value)),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 설정 > 화면에서 고른 밝기·디자인 (기본: 다크 · 루미너스 벤토)
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const design = parseDesign(jar.get(DESIGN_COOKIE)?.value);
  return (
    <html lang="ko" data-theme={theme} data-design={design} className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
