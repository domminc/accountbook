import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { todayKST } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { formatCompact } from "@/lib/format";
import { loadCategoryGroups } from "@/lib/data/settings";
import { listTransactions } from "@/lib/data/transactions";
import { loadReserveCategories, loadReserveEntries } from "@/lib/data/reserve";
import { addMonthly, annualByCategory, annualReserve, average, monthsElapsed, type AnnualGroup, type AnnualLine } from "@/lib/annual";
import { YearNav, parseYear } from "@/components/year-nav";
import { cardClass } from "@/components/ui";

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const today = todayKST();
  const year = parseYear(params.year, today);
  const range = { start: `${year}-01-01`, end: `${year}-12-31` };

  const data = await withUser(m.userId, async (tx) => {
    const [rows, groups, reserveCats, reserveEntries] = await Promise.all([
      listTransactions(tx, m.householdId, range),
      loadCategoryGroups(tx, m.householdId),
      loadReserveCategories(tx, m.householdId),
      loadReserveEntries(tx, m.householdId, range),
    ]);
    return { rows, groups, reserveCats, reserveEntries };
  });

  const elapsed = monthsElapsed(year, today);
  const byGroup = annualByCategory(data.rows, data.groups, year);
  const income = byGroup.filter((g) => g.kind === "income");
  const saving = byGroup.filter((g) => g.kind === "saving");
  const expense = byGroup.filter((g) => g.kind === "fixed_expense" || g.kind === "variable_expense");
  const reserve = annualReserve(data.reserveEntries, data.reserveCats, year);

  const incomeMonths = addMonthly(...income.map((g) => g.months));
  const savingMonths = addMonthly(...saving.map((g) => g.months));
  const expenseMonths = addMonthly(...expense.map((g) => g.months));
  const reserveMonths = addMonthly(...reserve.map((l) => l.months));
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const totals = {
    income: sum(incomeMonths),
    saving: sum(savingMonths),
    expense: sum(expenseMonths),
    reserve: sum(reserveMonths),
  };
  const maxExpense = Math.max(...expenseMonths.map((v, i) => v + reserveMonths[i]), 1);

  return (
    <div className="flex flex-col gap-5">
      <YearNav year={year} basePath="/reports" title="연간 리포트" />

      <dl className={`grid grid-cols-3 divide-x divide-border text-center ${cardClass}`}>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">총 수입</dt>
          <dd className="font-semibold tabular-nums">{formatWon(totals.income)}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">총 저축</dt>
          <dd className="font-semibold tabular-nums">{formatWon(totals.saving)}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">총 지출</dt>
          <dd className="font-semibold tabular-nums">{formatWon(totals.expense + totals.reserve)}</dd>
        </div>
      </dl>
      <p className="-mt-3 text-right text-xs text-muted">
        총 지출 = 월 지출 {formatWon(totals.expense)} + 예비비 {formatWon(totals.reserve)} · 평균은 {elapsed || "-"}개월로 나눔
      </p>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">월별 지출</h2>
        <p className="text-xs text-muted">고정지출 + 비고정지출 (진한 부분), 예비비 (옅은 부분)</p>
        <div
          role="img"
          aria-label={`월별 지출: ${expenseMonths.map((v, i) => `${i + 1}월 ${formatWon(v + reserveMonths[i])}원`).join(", ")}`}
          className="mt-3 grid h-40 grid-cols-12 items-end gap-1"
        >
          {expenseMonths.map((v, i) => {
            const r = reserveMonths[i];
            return (
              <div key={i} className="flex h-full flex-col justify-end" title={`${i + 1}월 지출 ${formatWon(v)}원, 예비비 ${formatWon(r)}원`}>
                {r > 0 ? <div className="rounded-t bg-accent/35" style={{ height: `${(r / maxExpense) * 100}%` }} /> : null}
                {v > 0 ? (
                  <div className={`bg-accent ${r > 0 ? "mt-0.5" : "rounded-t"}`} style={{ height: `${(v / maxExpense) * 100}%` }} />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-1 grid grid-cols-12 gap-1 text-center text-[10px] text-muted">
          {expenseMonths.map((v, i) => (
            <span key={i}>
              {i + 1}
              <span className="block tabular-nums text-foreground">{v + reserveMonths[i] ? formatCompact(v + reserveMonths[i], 0) : ""}</span>
            </span>
          ))}
        </div>
      </section>

      <AnnualTable title="수입" groups={income} elapsed={elapsed} totalLabel="총 수입" />
      <AnnualTable title="저축" groups={saving} elapsed={elapsed} totalLabel="총 저축" />
      <AnnualTable title="지출" groups={expense} elapsed={elapsed} totalLabel="총 지출 (고정지출 + 비고정지출)" />
      <AnnualTable
        title="예비비 지출"
        groups={reserve.length ? [{ id: "reserve", name: "예비비", kind: "variable_expense", lines: reserve, months: reserveMonths, total: totals.reserve }] : []}
        elapsed={elapsed}
        totalLabel="총 예비비"
        hideGroupRows
      />
    </div>
  );
}

function Cells({ line, elapsed, bold = false }: { line: { months: number[]; total: number }; elapsed: number; bold?: boolean }) {
  const cls = `px-2 py-1.5 text-right tabular-nums ${bold ? "font-semibold" : ""}`;
  return (
    <>
      <td className={`${cls} bg-accent/5`}>{line.total ? formatWon(line.total) : "-"}</td>
      {line.months.map((v, i) => (
        <td key={i} className={cls}>
          {v ? formatWon(v) : "-"}
        </td>
      ))}
      <td className={`${cls} bg-accent/5`}>{line.total ? formatWon(Math.round(average(line.total, elapsed))) : "-"}</td>
    </>
  );
}

function AnnualTable({
  title,
  groups,
  elapsed,
  totalLabel,
  hideGroupRows = false,
}: {
  title: string;
  groups: AnnualGroup[];
  elapsed: number;
  totalLabel: string;
  hideGroupRows?: boolean;
}) {
  if (groups.length === 0) return null;
  const months = addMonthly(...groups.map((g) => g.months));
  const total = { months, total: months.reduce((s, x) => s + x, 0) };
  const sticky = "sticky left-0 z-[1] bg-surface";

  return (
    <section className={`p-4 ${cardClass}`}>
      <h2 className="font-semibold">{title} 월별 상세표</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className={`${sticky} py-1 pr-3 text-left font-normal`}>항목</th>
              <th className="px-2 text-right font-normal">합계</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 text-right font-normal">
                  {m}
                </th>
              ))}
              <th className="px-2 text-right font-normal">평균</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows key={g.id} group={g} elapsed={elapsed} sticky={sticky} hideGroupRow={hideGroupRows || groups.length === 1} />
            ))}
            <tr className="border-t-2 border-border">
              <td className={`${sticky} py-1.5 pr-3 font-semibold`}>{totalLabel}</td>
              <Cells line={total} elapsed={elapsed} bold />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupRows({ group, elapsed, sticky, hideGroupRow }: { group: AnnualGroup; elapsed: number; sticky: string; hideGroupRow: boolean }) {
  return (
    <>
      {group.lines.map((l: AnnualLine) => (
        <tr key={l.id} className="border-t border-border">
          <td className={`${sticky} py-1.5 pr-3 ${hideGroupRow ? "" : "pl-3"}`}>{l.name}</td>
          <Cells line={l} elapsed={elapsed} />
        </tr>
      ))}
      {hideGroupRow ? null : (
        <tr className="border-t border-border bg-background/60">
          <td className={`${sticky} py-1.5 pr-3 font-medium`}>{group.name} 합계</td>
          <Cells line={group} elapsed={elapsed} bold />
        </tr>
      )}
    </>
  );
}
