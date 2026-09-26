import Link from "next/link";

/** 거래 내역 목록 ↔ 달력 전환 */
export function ViewTabs({ month, active }: { month: string; active: "list" | "calendar" }) {
  const tab = (key: "list" | "calendar", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex h-9 items-center justify-center rounded-lg text-sm ${active === key ? "bg-accent font-semibold text-accent-foreground" : "text-muted"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="보기 방식" className="grid grid-cols-2 rounded-xl border border-border bg-surface p-1">
      {tab("list", `/transactions?month=${month}`, "목록")}
      {tab("calendar", `/transactions/calendar?month=${month}`, "달력")}
    </nav>
  );
}
