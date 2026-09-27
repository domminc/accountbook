import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, currentMonthKST, formatMonthLabel } from "@/lib/month";
import { MonthSelect } from "./period-select";

/** ◀ [2026년 ▾][1월 ▾] ▶ — 이전·다음 달로, 또는 연·월을 골라 바로 이동 */
export function MonthNav({ month, basePath, title }: { month: string; basePath: string; title?: string }) {
  const href = (m: string) => `${basePath}?month=${m}`;
  return (
    <div className="flex items-center justify-between">
      <Link href={href(addMonths(month, -1))} aria-label="이전 달" className="flex size-10 items-center justify-center rounded-full bg-surface text-foreground shadow-card transition hover:bg-fill active:scale-95">
        <ChevronLeft aria-hidden size={20} />
      </Link>
      <div className="text-center">
        <h1 className="sr-only">{formatMonthLabel(month)}</h1>
        <MonthSelect key={`${basePath}?${month}`} month={month} thisYear={Number(currentMonthKST().slice(0, 4))} basePath={basePath} />
        {title ? <p className="text-xs text-muted">{title}</p> : null}
      </div>
      <Link href={href(addMonths(month, 1))} aria-label="다음 달" className="flex size-10 items-center justify-center rounded-full bg-surface text-foreground shadow-card transition hover:bg-fill active:scale-95">
        <ChevronRight aria-hidden size={20} />
      </Link>
    </div>
  );
}
