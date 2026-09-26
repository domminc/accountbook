import Link from "next/link";
import { segmentGroupClass, segmentItemClass } from "@/components/ui";

/** 거래 내역 목록 ↔ 달력 전환 */
export function ViewTabs({ month, active }: { month: string; active: "list" | "calendar" }) {
  const tab = (key: "list" | "calendar", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={segmentItemClass(active === key)}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="보기 방식" className={`grid-cols-2 ${segmentGroupClass}`}>
      {tab("list", `/transactions?month=${month}`, "목록")}
      {tab("calendar", `/transactions/calendar?month=${month}`, "달력")}
    </nav>
  );
}
