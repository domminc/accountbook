import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonthKST } from "@/lib/month";
import { YearSelect } from "./period-select";

export function YearNav({ year, basePath, title }: { year: number; basePath: string; title?: string }) {
  return (
    <div className="flex items-center justify-between">
      <Link href={`${basePath}?year=${year - 1}`} aria-label="이전 해" className="flex size-10 items-center justify-center tile rounded-full text-foreground transition hover:border-border-strong hover:brightness-125 active:scale-95">
        <ChevronLeft aria-hidden size={20} />
      </Link>
      <div className="text-center">
        <h1 className="sr-only">{year}년</h1>
        <YearSelect key={`${basePath}?${year}`} year={year} thisYear={Number(currentMonthKST().slice(0, 4))} basePath={basePath} />
        {title ? <p className="text-xs text-muted">{title}</p> : null}
      </div>
      <Link href={`${basePath}?year=${year + 1}`} aria-label="다음 해" className="flex size-10 items-center justify-center tile rounded-full text-foreground transition hover:border-border-strong hover:brightness-125 active:scale-95">
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
