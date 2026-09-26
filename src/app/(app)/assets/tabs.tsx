"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/assets", label: "자산" },
  { href: "/assets/loans", label: "대출" },
  { href: "/assets/cards", label: "카드" },
  { href: "/assets/accounts", label: "통장" },
  { href: "/assets/payments", label: "결제일" },
];

export function AssetsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="자산·금융" className="grid grid-cols-5 rounded-xl border border-border bg-surface p-1">
      {TABS.map((t) => {
        const active = t.href === "/assets" ? pathname === "/assets" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 items-center justify-center rounded-lg text-sm ${active ? "bg-accent font-semibold text-accent-foreground" : "text-muted"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
