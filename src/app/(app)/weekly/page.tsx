import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { monthRange, parseMonth } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { loadCategoryGroups, type CategoryGroup } from "@/lib/data/settings";
import { listTransactions } from "@/lib/data/transactions";
import { loadBudgets } from "@/lib/data/plan";
import { monthWeeks, weeklyByCategory } from "@/lib/summary";
import { MonthNav } from "@/components/month-nav";
import { cardClass } from "@/components/ui";

export default async function WeeklyPage({ searchParams }: PageProps<"/weekly">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = parseMonth(Array.isArray(params.month) ? params.month[0] : params.month);

  const { rows, groups, budgets } = await withUser(m.userId, async (tx) => {
    const [rows, groups, budgets] = await Promise.all([
      listTransactions(tx, m.householdId, monthRange(month)),
      loadCategoryGroups(tx, m.householdId),
      loadBudgets(tx, m.householdId, month),
    ]);
    return { rows, groups, budgets };
  });

  const weeks = monthWeeks(month);
  const weekLabels = weeks.map((w, i) => {
    const days = w.filter((d): d is string => d !== null);
    const fmt = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
    return { title: `${i + 1}주`, range: `${fmt(days[0])}~${fmt(days[days.length - 1])}` };
  });
  const byCat = weeklyByCategory(rows, month);
  const zero = () => weeks.map(() => 0);

  const tableGroups = (kind: CategoryGroup["kind"]) =>
    groups
      .filter((g) => g.kind === kind)
      .map((g) => {
        const cats = g.categories.map((c) => {
          const w = byCat.get(c.id) ?? zero();
          return { id: c.id, name: c.name, hidden: c.isHidden, weeks: w, total: w.reduce((s, x) => s + x, 0) };
        });
        const weeksTotal = zero().map((_, i) => cats.reduce((s, c) => s + c.weeks[i], 0));
        const total = weeksTotal.reduce((s, x) => s + x, 0);
        return { group: g, cats: cats.filter((c) => !c.hidden || c.total > 0), weeksTotal, total, budget: budgets.get(g.id) ?? null };
      })
      .filter((t) => !t.group.isHidden || t.total > 0 || t.budget !== null);

  const fixed = tableGroups("fixed_expense");
  const variable = tableGroups("variable_expense");
  // 지출도 예산도 없는 대분류는 표 대신 한 줄로
  const shown = (t: ReturnType<typeof tableGroups>[number]) => t.total > 0 || t.budget !== null;
  const emptyNames = [...fixed, ...variable].filter((t) => !shown(t)).map((t) => t.group.name);
  const variableWeeks = zero().map((_, i) => variable.reduce((s, t) => s + t.weeksTotal[i], 0));
  const variableTotal = variable.reduce((s, t) => s + t.total, 0);
  const variableBudget = variable.reduce((s, t) => s + (t.budget ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <MonthNav month={month} basePath="/weekly" title="주간별 표 (월요일 시작)" />

      <h2 className="font-semibold">고정지출</h2>
      {fixed.filter(shown).map((t) => (
        <GroupTable key={t.group.id} {...t} weekLabels={weekLabels} />
      ))}

      <h2 className="mt-2 font-semibold">비고정지출</h2>
      {variable.filter(shown).map((t) => (
        <GroupTable key={t.group.id} {...t} weekLabels={weekLabels} />
      ))}
      {emptyNames.length > 0 ? <p className="text-sm text-muted">이번 달 지출 없음: {emptyNames.join(", ")}</p> : null}

      <section className={`overflow-x-auto p-4 ${cardClass}`}>
        <table className="w-full min-w-max table-fixed text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="w-24 pr-3 text-left font-normal">총 비고정지출</th>
              <th className="w-20 px-2 text-right font-normal">합계</th>
              {weekLabels.map((w) => (
                <th key={w.title} className="w-20 px-2 text-right font-normal">
                  {w.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="font-semibold">
              <td className="pr-3">합계</td>
              <td className="px-2 text-right tabular-nums">{formatWon(variableTotal)}</td>
              {variableWeeks.map((v, i) => (
                <td key={i} className="px-2 text-right tabular-nums">
                  {formatWon(v)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {variableBudget > 0 ? <BudgetDiff budget={variableBudget} total={variableTotal} label="총 예산" /> : null}
      </section>
    </div>
  );
}

function BudgetDiff({ budget, total, label = "예산" }: { budget: number; total: number; label?: string }) {
  const diff = budget - total;
  return (
    <p className="mt-2 text-right text-xs text-muted">
      {label} {formatWon(budget)} ·{" "}
      {diff >= 0 ? <span className="text-accent">▼ {formatWon(diff)} 남음</span> : <span className="text-danger">▲ {formatWon(-diff)} 초과</span>}
    </p>
  );
}

function GroupTable({
  group,
  cats,
  weeksTotal,
  total,
  budget,
  weekLabels,
}: {
  group: CategoryGroup;
  cats: { id: string; name: string; weeks: number[]; total: number }[];
  weeksTotal: number[];
  total: number;
  budget: number | null;
  weekLabels: { title: string; range: string }[];
}) {
  return (
    <section className={`overflow-x-auto p-4 ${cardClass}`}>
      <table className="w-full min-w-max table-fixed text-sm">
        <caption className="mb-2 text-left font-medium">{group.name}</caption>
        <thead>
          <tr className="text-xs text-muted">
            <th className="w-24 pr-3 text-left font-normal">소분류</th>
            <th className="w-20 px-2 text-right font-normal">합계</th>
            {weekLabels.map((w) => (
              <th key={w.title} className="w-20 px-2 text-right font-normal">
                {w.title}
                <span className="block text-[10px]">{w.range}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="py-1.5 pr-3">{c.name}</td>
              <td className="px-2 text-right font-medium tabular-nums">{c.total ? formatWon(c.total) : "-"}</td>
              {c.weeks.map((v, i) => (
                <td key={i} className="px-2 text-right tabular-nums">
                  {v ? formatWon(v) : "-"}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-border font-semibold">
            <td className="py-1.5 pr-3">합계</td>
            <td className="px-2 text-right tabular-nums">{formatWon(total)}</td>
            {weeksTotal.map((v, i) => (
              <td key={i} className="px-2 text-right tabular-nums">
                {v ? formatWon(v) : "-"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {budget !== null ? <BudgetDiff budget={budget} total={total} /> : null}
    </section>
  );
}
