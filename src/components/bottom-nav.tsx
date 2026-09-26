"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; label: string; match: (p: string) => boolean };

// 휴대폰 아래 메뉴: 자주 쓰는 다섯 개. 자산·결제일 화면은 설정에서 들어간다
const MOBILE: Item[] = [
  { href: "/", label: "홈", match: (p) => p === "/" },
  { href: "/transactions", label: "내역", match: (p) => p.startsWith("/transactions") },
  { href: "/reserve", label: "예비비", match: (p) => p.startsWith("/reserve") },
  { href: "/reports", label: "연간", match: (p) => p.startsWith("/reports") },
  { href: "/settings", label: "설정", match: (p) => p.startsWith("/settings") || p.startsWith("/assets") },
];

// PC 왼쪽 메뉴: 화면이 넓으니 주요 화면을 모두 보여준다
const DESKTOP: { title?: string; items: Item[] }[] = [
  {
    items: [
      { href: "/", label: "이달의 정리", match: (p) => p === "/" },
      { href: "/transactions", label: "거래 내역", match: (p) => p === "/transactions" || /^\/transactions\/[0-9a-f-]{36}$/.test(p) },
      { href: "/transactions/calendar", label: "달력", match: (p) => p.startsWith("/transactions/calendar") },
      { href: "/transactions/paste", label: "카드 문자로 입력", match: (p) => p.startsWith("/transactions/paste") },
      { href: "/budget", label: "목표·예산", match: (p) => p.startsWith("/budget") },
      { href: "/weekly", label: "주간별 표", match: (p) => p.startsWith("/weekly") },
    ],
  },
  {
    title: "모아 보기",
    items: [
      { href: "/reports", label: "연간 리포트", match: (p) => p.startsWith("/reports") },
      { href: "/reserve", label: "예비비", match: (p) => p.startsWith("/reserve") },
      { href: "/assets", label: "자산·대출·카드", match: (p) => p.startsWith("/assets") },
    ],
  },
  {
    title: "설정",
    items: [{ href: "/settings", label: "설정", match: (p) => p.startsWith("/settings") }],
  },
];

export function BottomNav({ householdName }: { householdName?: string }) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="메뉴" className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {MOBILE.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-14 items-center justify-center text-sm ${active ? "font-semibold text-accent" : "text-muted"}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="PC 메뉴" className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
        <Link href="/" className="px-3 text-lg font-bold">
          가계부
        </Link>
        {householdName ? <p className="truncate px-3 text-xs text-muted">{householdName}</p> : null}
        <Link
          href="/transactions/new"
          className="mt-4 flex h-10 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground"
        >
          + 거래 입력
        </Link>
        {DESKTOP.map((section, i) => (
          <div key={i} className="mt-5">
            {section.title ? <p className="px-3 pb-1 text-xs text-muted">{section.title}</p> : null}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm ${active ? "bg-accent/10 font-semibold text-accent" : "text-foreground hover:bg-background"}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

// 표·달력·대시보드처럼 넓게 보는 화면. 나머지(입력 폼·설정)는 PC에서도 읽기 좋은 폭으로
const WIDE = [/^\/$/, /^\/transactions$/, /^\/transactions\/calendar/, /^\/reports/, /^\/weekly/, /^\/reserve/, /^\/assets$/];

export function MainArea({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wide = WIDE.some((r) => r.test(pathname));
  return (
    <main className={`mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-28 lg:pt-8 lg:pb-12 ${wide ? "lg:max-w-6xl" : "lg:max-w-3xl"}`}>
      {children}
    </main>
  );
}
