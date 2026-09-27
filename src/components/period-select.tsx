"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";

const selectClass =
  "h-10 cursor-pointer appearance-none rounded-xl bg-transparent py-0 pl-2 pr-7 text-xl font-bold tracking-tight text-foreground transition hover:bg-fill focus-visible:bg-fill focus-visible:outline-none";

function Picker({ label, value, options, onChange }: { label: string; value: number; options: { value: number; text: string }[]; onChange: (v: number) => void }) {
  return (
    <span className="relative inline-flex items-center">
      <select aria-label={label} defaultValue={value} onChange={(e) => onChange(Number(e.target.value))} className={selectClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden size={16} className="pointer-events-none absolute right-2 text-muted" />
    </span>
  );
}

/** 보는 해·올해 앞뒤로 고를 수 있는 해 */
export function yearOptions(year: number, thisYear: number): number[] {
  const from = Math.min(year, thisYear) - 5;
  const to = Math.max(year, thisYear) + 1;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 연·월을 골라 바로 그 달로 이동 */
export function MonthSelect({ month, thisYear, basePath }: { month: string; thisYear: number; basePath: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [y, m] = month.split("-").map(Number);
  const go = (year: number, mon: number) =>
    startTransition(() => router.push(`${basePath}?month=${year}-${String(mon).padStart(2, "0")}`));

  return (
    <div className={`flex items-center justify-center ${pending ? "opacity-50" : ""}`}>
      <Picker label="연도" value={y} options={yearOptions(y, thisYear).map((v) => ({ value: v, text: `${v}년` }))} onChange={(v) => go(v, m)} />
      <Picker label="월" value={m} options={MONTHS.map((v) => ({ value: v, text: `${v}월` }))} onChange={(v) => go(y, v)} />
    </div>
  );
}

/** 해를 골라 바로 그 해로 이동 */
export function YearSelect({ year, thisYear, basePath }: { year: number; thisYear: number; basePath: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className={`flex items-center justify-center ${pending ? "opacity-50" : ""}`}>
      <Picker
        label="연도"
        value={year}
        options={yearOptions(year, thisYear).map((v) => ({ value: v, text: `${v}년` }))}
        onChange={(v) => startTransition(() => router.push(`${basePath}?year=${v}`))}
      />
    </div>
  );
}
