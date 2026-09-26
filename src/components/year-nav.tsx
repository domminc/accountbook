import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function YearNav({ year, basePath, title }: { year: number; basePath: string; title?: string }) {
  return (
    <div className="flex items-center justify-between">
      <Link href={`${basePath}?year=${year - 1}`} aria-label="이전 해" className="flex size-10 items-center justify-center rounded-full bg-surface text-foreground shadow-card transition hover:bg-fill active:scale-95">
        <ChevronLeft aria-hidden size={20} />
      </Link>
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">{year}년</h1>
        {title ? <p className="text-xs text-muted">{title}</p> : null}
      </div>
      <Link href={`${basePath}?year=${year + 1}`} aria-label="다음 해" className="flex size-10 items-center justify-center rounded-full bg-surface text-foreground shadow-card transition hover:bg-fill active:scale-95">
        <ChevronRight aria-hidden size={20} />
      </Link>
    </div>
  );
}

/** 쿼리 문자열의 연도. 잘못되면 올해. */
export function parseYear(value: string | string[] | undefined, today: string): number {
  const v = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(v) && v >= 2000 && v <= 2100 ? v : Number(today.slice(0, 4));
}
