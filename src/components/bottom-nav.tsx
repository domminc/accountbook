"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "홈", match: (p: string) => p === "/" },
  { href: "/transactions", label: "내역", match: (p: string) => p.startsWith("/transactions") },
  { href: "/reserve", label: "예비비", match: (p: string) => p.startsWith("/reserve") },
  { href: "/reports", label: "연간", match: (p: string) => p.startsWith("/reports") },
  // 자산·결제일 화면은 설정에서 들어간다
  { href: "/settings", label: "설정", match: (p: string) => p.startsWith("/settings") || p.startsWith("/assets") },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="메뉴" className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {ITEMS.map((item) => {
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
  );
}
