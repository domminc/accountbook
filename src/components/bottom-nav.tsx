"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChartColumn,
  House,
  MessageSquareText,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  Table2,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };

// 휴대폰 아래 메뉴: 자주 쓰는 다섯 개. 자산·결제일 화면은 설정에서 들어간다
const MOBILE: Item[] = [
  { href: "/", label: "홈", icon: House, match: (p) => p === "/" },
  { href: "/transactions", label: "내역", icon: ReceiptText, match: (p) => p.startsWith("/transactions") },
  { href: "/reserve", label: "예비비", icon: PiggyBank, match: (p) => p.startsWith("/reserve") },
  { href: "/reports", label: "연간", icon: ChartColumn, match: (p) => p.startsWith("/reports") },
  { href: "/settings", label: "설정", icon: Settings, match: (p) => p.startsWith("/settings") || p.startsWith("/assets") },
];

// PC 왼쪽 메뉴: 화면이 넓으니 주요 화면을 모두 보여준다
const DESKTOP: { title?: string; items: Item[] }[] = [
  {
    items: [
      { href: "/", label: "이달의 정리", icon: House, match: (p) => p === "/" },
      { href: "/transactions", label: "거래 내역", icon: ReceiptText, match: (p) => p === "/transactions" || /^\/transactions\/[0-9a-f-]{36}$/.test(p) },
      { href: "/transactions/calendar", label: "달력", icon: CalendarDays, match: (p) => p.startsWith("/transactions/calendar") },
      { href: "/transactions/paste", label: "카드 문자로 입력", icon: MessageSquareText, match: (p) => p.startsWith("/transactions/paste") },
      { href: "/budget", label: "목표·예산", icon: Target, match: (p) => p.startsWith("/budget") },
      { href: "/weekly", label: "주간별 표", icon: Table2, match: (p) => p.startsWith("/weekly") },
    ],
  },
  {
    title: "모아 보기",
    items: [
      { href: "/reports", label: "연간 리포트", icon: ChartColumn, match: (p) => p.startsWith("/reports") },
      { href: "/reserve", label: "예비비", icon: PiggyBank, match: (p) => p.startsWith("/reserve") },
      { href: "/assets", label: "자산·대출·카드", icon: Wallet, match: (p) => p.startsWith("/assets") },
    ],
  },
  {
    title: "설정",
    items: [{ href: "/settings", label: "설정", icon: Settings, match: (p) => p.startsWith("/settings") }],
  },
];

export function BottomNav({ householdName }: { householdName?: string }) {
  const pathname = usePathname();
  return (
    <>
      <nav
        aria-label="메뉴"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border/70 bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {MOBILE.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${active ? "text-accent" : "text-muted"}`}
                >
                  <Icon aria-hidden size={22} strokeWidth={active ? 2.4 : 1.8} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="PC 메뉴" className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col overflow-y-auto border-r border-border/70 bg-surface px-4 py-6 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Wallet size={20} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-base leading-tight font-bold">가계부</span>
            {householdName ? <span className="block max-w-36 truncate text-xs text-muted">{householdName}</span> : null}
          </span>
        </Link>
        <Link
          href="/transactions/new"
          className="mt-6 flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-accent text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-110 active:scale-[0.98]"
        >
          <Plus aria-hidden size={18} strokeWidth={2.4} />
          거래 입력
        </Link>
        {DESKTOP.map((section, i) => (
          <div key={i} className="mt-6">
            {section.title ? <p className="px-3 pb-1.5 text-xs font-medium text-muted">{section.title}</p> : null}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                        active ? "bg-accent-soft font-semibold text-accent" : "text-foreground/80 hover:bg-fill hover:text-foreground"
                      }`}
                    >
                      <Icon aria-hidden size={18} strokeWidth={active ? 2.3 : 1.8} />
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
    <main className={`mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-12 ${wide ? "lg:max-w-6xl" : "lg:max-w-3xl"}`}>
      {children}
    </main>
  );
}
