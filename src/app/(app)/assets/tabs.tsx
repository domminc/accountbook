"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { segmentGroupClass, segmentItemClass } from "@/components/ui";

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
    <nav aria-label="자산·금융" className={`grid-cols-5 ${segmentGroupClass}`}>
      {TABS.map((t) => {
        const active = t.href === "/assets" ? pathname === "/assets" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={segmentItemClass(active)}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
