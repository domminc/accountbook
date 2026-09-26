import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, formatMonthLabel } from "@/lib/month";

/** ◀ 2026년 1월 ▶ — 같은 화면의 이전·다음 달로 이동 */
export function MonthNav({ month, basePath, title }: { month: string; basePath: string; title?: string }) {
  const href = (m: string) => `${basePath}?month=${m}`;
  return (
    <div className="flex items-center justify-between">
      <Link href={href(addMonths(month, -1))} aria-label="이전 달" className="flex size-10 items-center justify-center rounded-full bg-surface text-foreground shadow-card transition hover:bg-fill active:scale-95">
        <ChevronLeft aria-hidden size={20} />
      </Link>
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">{formatMonthLabel(month)}</h1>
        {title ? <p className="text-xs text-muted">{title}</p> : null}
      </div>
      <Link href={href(addMonths(month, 1))} aria-label="다음 달" className="flex size-10 items-center justify-center rounded-full bg-surface text-foreground shadow-card transition hover:bg-fill active:scale-95">
        <ChevronRight aria-hidden size={20} />
      </Link>
    </div>
  );
}
