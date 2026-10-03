import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { formatDateLabel, isValidDate, monthRange, parseMonth, todayKST } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { formatCompact } from "@/lib/format";
import { listTransactions } from "@/lib/data/transactions";
import { loadReserveOut } from "@/lib/data/plan";
import { calendarTotals, dailyCells, monthWeeks } from "@/lib/summary";
import { MonthNav } from "@/components/month-nav";
import { WEEKDAYS_SUN, dayNumberClass, weekdayHeaderClass } from "@/components/calendar-day";
import { holidayName } from "@/lib/holidays";
import { cardClass } from "@/components/ui";
import { ViewTabs } from "../view-tabs";

export default async function CalendarPage({ searchParams }: PageProps<"/transactions/calendar">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = parseMonth(Array.isArray(params.month) ? params.month[0] : params.month);
  const dayParam = Array.isArray(params.day) ? params.day[0] : params.day;
  const range = monthRange(month);
  const today = todayKST();
  const selected = isValidDate(dayParam) && dayParam.startsWith(month) ? dayParam : null;

  const { rows, reserve } = await withUser(m.userId, async (tx) => {
    const [rows, reserve] = await Promise.all([
      listTransactions(tx, m.householdId, range),
      loadReserveOut(tx, m.householdId, range),
    ]);
    return { rows, reserve };
  });
  const cells = dailyCells(rows, reserve, month, today);
  const totals = calendarTotals(cells);
  const dayRows = selected ? rows.filter((r) => r.occurredOn === selected) : [];
  const selectedCell = selected ? cells.get(selected) : null;

  return (
    <div className="flex flex-col gap-4">
      <MonthNav month={month} basePath="/transactions/calendar" />
      <ViewTabs month={month} active="calendar" />

      <dl className={`grid grid-cols-3 divide-x divide-border text-center ${cardClass}`}>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">월 수입</dt>
          <dd className="font-semibold tabular-nums">{formatWon(totals.income)}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">월 저축</dt>
          <dd className="font-semibold tabular-nums">{formatWon(totals.saving)}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">월 지출 (예비비 포함)</dt>
          <dd className="font-semibold tabular-nums">{formatWon(totals.expense)}</dd>
        </div>
      </dl>
      <p className="-mt-2 text-right text-xs text-muted">무지출 {totals.noSpendDays}일 · 칸의 숫자는 그날 지출</p>

      <table className={`w-full table-fixed text-center ${cardClass}`}>
        <thead>
          <tr>
            {WEEKDAYS_SUN.map((d, i) => (
              <th key={d} className={`pt-2 pb-1 text-xs font-medium ${weekdayHeaderClass(i)}`}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(month, "sun").map((week, i) => (
            <tr key={i} className="border-t border-border">
              {week.map((date, j) => {
                if (!date) return <td key={j} />;
                const c = cells.get(date)!;
                const spend = c.fixed + c.variable + c.reserve;
                const isSelected = date === selected;
                const holiday = holidayName(date);
                return (
                  <td key={j} className="p-0.5 align-top">
                    <Link
                      href={`/transactions/calendar?month=${month}&day=${date}`}
                      title={holiday ?? undefined}
                      aria-label={`${formatDateLabel(date)}${holiday ? ` ${holiday}` : ""} 지출 ${formatWon(spend)}원${c.noSpend ? ", 무지출" : ""}`}
                      className={`flex h-[4.5rem] flex-col items-center overflow-hidden rounded-xl pt-1 text-xs transition lg:h-24 ${
                        isSelected ? "cta" : c.noSpend ? "bg-accent/15" : "hover:bg-fill"
                      }`}
                    >
                      <span
                        className={`text-sm ${isSelected ? "" : dayNumberClass(date)} ${date === today && !isSelected ? "font-bold underline underline-offset-2" : ""}`}
                      >
                        {Number(date.slice(8))}
                      </span>
                      {holiday ? (
                        <span className={`max-w-full truncate px-0.5 text-[10px] leading-tight ${isSelected ? "" : "text-danger"}`}>
                          {holiday.startsWith("대체공휴일") ? "대체휴일" : holiday}
                        </span>
                      ) : null}
                      {c.income > 0 ? <span className={isSelected ? "" : "text-accent"}>+{formatCompact(c.income)}</span> : null}
                      {spend > 0 ? <span className="tabular-nums">{formatCompact(spend)}</span> : null}
                      {c.noSpend && spend === 0 && c.income === 0 ? (
                        <span className={isSelected ? "" : "text-accent"} aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {selected && selectedCell ? (
        <section className={`p-4 ${cardClass}`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">
              {formatDateLabel(selected)}
              {holidayName(selected) ? <span className="ml-2 text-sm font-medium text-danger">{holidayName(selected)}</span> : null}
            </h2>
            <Link href={`/transactions/new?month=${month}`} className="text-sm text-muted">
              + 입력
            </Link>
          </div>
          <dl className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">
            {(
              [
                ["수입", selectedCell.income],
                ["저축", selectedCell.saving],
                ["고정지출", selectedCell.fixed],
                ["비고정", selectedCell.variable],
                ["예비비", selectedCell.reserve],
              ] as const
            ).map(([label, v]) => (
              <div key={label}>
                <dt className="text-muted">{label}</dt>
                <dd className="tabular-nums">{formatWon(v)}</dd>
              </div>
            ))}
          </dl>
          {dayRows.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{selectedCell.noSpend ? "무지출 Day예요." : "이날 거래가 없어요."}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {dayRows.map((r) => (
                <li key={r.id}>
                  <Link href={`/transactions/${r.id}`} className="flex justify-between gap-3 py-2 text-sm">
                    <span className="truncate">
                      {r.categoryName ? `${r.groupName} · ${r.categoryName}` : "분류 필요"}
                      {r.memo ? <span className="text-muted"> · {r.memo}</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatWon(r.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-center text-sm text-muted">날짜를 누르면 그날 거래를 볼 수 있어요.</p>
      )}
    </div>
  );
}
