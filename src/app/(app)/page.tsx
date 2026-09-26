import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { addMonths, currentMonthKST, formatDateLabel, monthRange, parseMonth, todayKST } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { formatDelta, formatPercent } from "@/lib/format";
import { loadCategoryGroups, loadSimpleItems, type CategoryGroup } from "@/lib/data/settings";
import { listTransactions } from "@/lib/data/transactions";
import { limitTargetNames, loadBudgets, loadEvents, loadGoals, loadSpendingLimits, type GoalKind, type Goals } from "@/lib/data/plan";
import { overspendAlerts, type OverspendAlert } from "@/lib/overspend";
import { loadDuePayments, type DuePayment } from "@/lib/data/payments";
import { loadCardInfos } from "@/lib/data/finance";
import {
  budgetRows,
  byPaymentMethod,
  byTag,
  cardUsage,
  dailyCells,
  monthTotals,
  monthWeeks,
  spendingShare,
  sumByCategory,
  type BudgetRow,
  type DayCell,
  type MonthTotals,
  type NamedAmount,
  type ShareItem,
} from "@/lib/summary";
import { Meter, meterState } from "@/components/meter";
import { CardUsageList } from "@/components/card-usage";
import { MonthNav } from "@/components/month-nav";
import { cardClass, primaryButtonClass, smallButtonClass } from "@/components/ui";

export default async function MonthSummaryPage({ searchParams }: PageProps<"/">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = parseMonth(Array.isArray(params.month) ? params.month[0] : params.month);
  const range = monthRange(month);
  const today = todayKST();

  const data = await withUser(m.userId, async (tx) => {
    const [rows, prevRows, groups, methods, tags, budgets, goals, events, due, cards, pastRows, limits] = await Promise.all([
      listTransactions(tx, m.householdId, range),
      listTransactions(tx, m.householdId, monthRange(addMonths(month, -1))),
      loadCategoryGroups(tx, m.householdId),
      loadSimpleItems(tx, m.householdId, "payment_methods"),
      loadSimpleItems(tx, m.householdId, "tags"),
      loadBudgets(tx, m.householdId, month),
      loadGoals(tx, m.householdId, month),
      loadEvents(tx, m.householdId, range),
      // 결제 예정은 이번 달을 볼 때만
      month === currentMonthKST() ? loadDuePayments(tx, m.householdId, month, today) : Promise.resolve([]),
      loadCardInfos(tx, m.householdId),
      // 과소비 알림: 지난 3개월 평균과 비교
      listTransactions(tx, m.householdId, { start: monthRange(addMonths(month, -3)).start, end: monthRange(addMonths(month, -1)).end }),
      loadSpendingLimits(tx, m.householdId),
    ]);
    return { rows, prevRows, groups, methods, tags, budgets, goals, events, due, cards, pastRows, limits };
  });

  const totals = monthTotals(data.rows);
  const prev = monthTotals(data.prevRows);
  const cells = dailyCells(data.rows, [], month, today);
  const uncategorized = data.rows.filter((r) => !r.kind).length;
  const cards = cardUsage(data.cards, data.rows);
  const alerts = overspendAlerts({
    rows: data.rows,
    pastRows: data.pastRows,
    month,
    limits: data.limits,
    names: limitTargetNames(data.groups, data.tags),
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <MonthNav month={month} basePath="/" title={`${m.householdName} · 이달의 정리`} />
        <p className="text-center text-xs text-muted">
          {range.start.replaceAll("-", ".")} ~ {range.end.slice(5).replace("-", ".")}
        </p>
      </div>

      {/* PC: 요약(넓게)과 바로 가기를 한 줄에 */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <SummaryCard totals={totals} prev={prev} />
          {uncategorized > 0 ? (
            <Link href={`/transactions?month=${month}&uncategorized=1`} className="text-sm text-danger underline underline-offset-4">
              분류가 필요한 거래 {uncategorized}건은 합계에 들어가지 않았어요
            </Link>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Link href={`/transactions/new?month=${month}`} className={`flex items-center justify-center ${primaryButtonClass}`}>
            거래 입력
          </Link>
          <div className="grid grid-cols-3 gap-2">
            <Link href={`/budget?month=${month}`} className={`flex items-center justify-center ${smallButtonClass}`}>
              목표·예산
            </Link>
            <Link href={`/weekly?month=${month}`} className={`flex items-center justify-center ${smallButtonClass}`}>
              주간별 표
            </Link>
            <Link href={`/transactions/calendar?month=${month}`} className={`flex items-center justify-center ${smallButtonClass}`}>
              달력
            </Link>
          </div>
        </div>
      </div>

      {/* PC: 카드들을 두 단으로 */}
      <div className="flex flex-col gap-5 lg:block lg:columns-2 lg:gap-5 lg:*:mb-5 lg:*:break-inside-avoid">
        <DueCard due={data.due} month={month} />
        <OverspendCard alerts={alerts} month={month} />
        <GoalsCard goals={data.goals} totals={totals} rows={data.rows} groups={data.groups} month={month} />
        <BudgetCard rows={budgetRows(data.rows, data.groups, data.budgets)} month={month} />
        <ShareCard items={spendingShare(data.rows, data.groups)} />
        <NoSpendCard month={month} cells={cells} today={today} />
        <AmountList title="결제 수단별 지출" items={byPaymentMethod(data.rows, data.methods)} empty="지출방법을 고른 지출이 없어요." />
        <AmountList title="태그별 금액" items={byTag(data.rows, data.tags)} empty="태그를 붙인 거래가 없어요." />

        {cards.length > 0 ? (
          <section className={`p-5 ${cardClass}`}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">카드별 사용</h2>
              <Link href={`/assets/cards?month=${month}`} className="text-sm text-muted">
                카드 관리
              </Link>
            </div>
            <div className="mt-3">
              <CardUsageList items={cards} />
            </div>
          </section>
        ) : null}

        <section className={`p-5 ${cardClass}`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">이달의 이벤트</h2>
            <Link href={`/budget?month=${month}`} className="text-sm text-muted">
              편집
            </Link>
          </div>
          {data.events.length === 0 ? (
            <p className="mt-2 text-sm text-muted">등록한 이벤트가 없어요.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {data.events.map((e) => (
                <li key={e.id} className="flex gap-3 py-2 text-sm">
                  <span className="w-24 shrink-0 text-muted">{formatDateLabel(e.occurredOn)}</span>
                  <span className="min-w-0 flex-1">{e.content}</span>
                  {e.budget ? <span className="tabular-nums">{formatWon(e.budget)}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Delta({ value, better }: { value: number; better: "up" | "down" }) {
  if (value === 0) return <span className="text-xs text-muted">전월과 같음</span>;
  const good = better === "up" ? value > 0 : value < 0;
  return (
    <span className={`text-xs ${good ? "text-accent" : "text-muted"}`}>
      전월 대비 {formatDelta(value)}
    </span>
  );
}

function SummaryCard({ totals, prev }: { totals: MonthTotals; prev: MonthTotals }) {
  return (
    <section className={`p-5 ${cardClass}`} aria-label="이달 요약">
      <p className="text-sm text-muted">남은 금액 (수입 − 지출)</p>
      <p className={`text-3xl font-bold break-all sm:text-4xl ${totals.remaining < 0 ? "text-danger" : ""}`}>{formatWon(totals.remaining)}원</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 sm:grid-cols-4 [&_dd]:break-all [&>div]:min-w-0">
        <div>
          <dt className="text-sm text-muted">총 수입</dt>
          <dd className="text-lg font-semibold">{formatWon(totals.income)}</dd>
          <dd>
            <Delta value={totals.income - prev.income} better="up" />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">총 지출</dt>
          <dd className="text-lg font-semibold">{formatWon(totals.expense)}</dd>
          <dd>
            <Delta value={totals.expense - prev.expense} better="down" />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">총 저축</dt>
          <dd className="text-lg font-semibold">{formatWon(totals.saving)}</dd>
          <dd>
            <Delta value={totals.saving - prev.saving} better="up" />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">저축률</dt>
          <dd className="text-lg font-semibold">{totals.savingRate === null ? "-" : formatPercent(totals.savingRate)}</dd>
          <dd className="text-xs text-muted">
            고정 {formatWon(totals.fixed)} · 비고정 {formatWon(totals.variable)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

const GOAL_LABEL: Record<GoalKind, string> = { income: "수입", saving: "저축", expense: "지출" };

function GoalsCard({
  goals,
  totals,
  rows,
  groups,
  month,
}: {
  goals: Goals;
  totals: MonthTotals;
  rows: Parameters<typeof sumByCategory>[0];
  groups: CategoryGroup[];
  month: string;
}) {
  const byCat = sumByCategory(rows);
  // 목표 관리 표: 수입·저축은 소분류별, 지출은 고정·비고정
  const breakdown = (kind: "income" | "saving") =>
    groups
      .filter((g) => g.kind === kind)
      .flatMap((g) => g.categories)
      .map((c) => ({ name: c.name, amount: byCat.get(c.id) ?? 0 }))
      .filter((c) => c.amount > 0);
  const lines: { kind: GoalKind; actual: number; detail: { name: string; amount: number }[] }[] = [
    { kind: "income", actual: totals.income, detail: breakdown("income") },
    { kind: "saving", actual: totals.saving, detail: breakdown("saving") },
    {
      kind: "expense",
      actual: totals.expense,
      detail: [
        { name: "고정지출", amount: totals.fixed },
        { name: "비고정지출", amount: totals.variable },
      ],
    },
  ];

  return (
    <section className={`p-5 ${cardClass}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">목표 관리</h2>
        <Link href={`/budget?month=${month}`} className="text-sm text-muted">
          목표 설정
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-4">
        {lines.map(({ kind, actual, detail }) => {
          const goal = goals[kind];
          const target = goal?.amount ?? 0;
          const diff = target - actual;
          return (
            <li key={kind}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{GOAL_LABEL[kind]}</span>
                <span className="text-sm">
                  <span className="font-semibold">{formatWon(actual)}</span>
                  <span className="text-muted"> / {target > 0 ? formatWon(target) : "목표 없음"}</span>
                </span>
              </div>
              {target > 0 ? (
                <>
                  <div className="mt-1.5">
                    <Meter value={actual} max={target} kind={kind === "expense" ? "limit" : "target"} label={`${GOAL_LABEL[kind]} 목표 달성률`} />
                  </div>
                  <p className="mt-1 flex justify-between text-xs text-muted">
                    <span>달성률 {formatPercent(actual / target)}</span>
                    <span className={kind === "expense" && diff < 0 ? "text-danger" : ""}>
                      {diff >= 0 ? `목표까지 ${formatWon(diff)}` : `${formatWon(-diff)} 초과`}
                    </span>
                  </p>
                </>
              ) : null}
              {detail.length > 0 ? (
                <p className="mt-1 text-xs text-muted">{detail.map((d) => `${d.name} ${formatWon(d.amount)}`).join(" · ")}</p>
              ) : null}
              {goal?.note ? <p className="mt-1 text-xs">{goal.note}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BudgetCard({ rows, month }: { rows: BudgetRow[]; month: string }) {
  const shown = rows.filter((r) => r.budget !== null || r.spent > 0);
  const variable = rows.filter((r) => r.kind === "variable_expense");
  const totalBudget = variable.reduce((s, r) => s + (r.budget ?? 0), 0);
  const totalSpent = variable.reduce((s, r) => s + r.spent, 0);

  return (
    <section className={`p-5 ${cardClass}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">대분류별 예산</h2>
        <Link href={`/budget?month=${month}`} className="text-sm text-muted">
          예산 설정
        </Link>
      </div>
      {totalBudget > 0 ? (
        <div className="mt-3 rounded-xl bg-background p-3">
          <div className="flex justify-between text-sm">
            <span>총 비고정지출</span>
            <span>
              <span className="font-semibold">{formatWon(totalSpent)}</span>
              <span className="text-muted"> / {formatWon(totalBudget)}</span>
            </span>
          </div>
          <div className="mt-1.5">
            <Meter value={totalSpent} max={totalBudget} kind="limit" label="총 비고정지출 예산" />
          </div>
          <p className="mt-1 text-right text-xs text-muted">
            {totalBudget - totalSpent >= 0 ? `남은 예산 ${formatWon(totalBudget - totalSpent)}` : `${formatWon(totalSpent - totalBudget)} 초과`}
          </p>
        </div>
      ) : null}
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-muted">예산을 정하거나 지출을 입력하면 여기에 보여요.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {shown.map((r) => {
            const state = r.budget ? meterState(r.spent, r.budget) : "ok";
            return (
              <li key={r.groupId}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    {r.name}
                    {r.kind === "fixed_expense" ? <span className="ml-1 text-xs text-muted">고정</span> : null}
                    {state === "over" ? <span className="ml-1.5 text-xs font-semibold text-danger">▲ 초과</span> : null}
                    {state === "near" ? <span className="ml-1.5 text-xs font-semibold text-warning">● 80% 넘음</span> : null}
                  </span>
                  <span>
                    <span className="font-semibold">{formatWon(r.spent)}</span>
                    <span className="text-muted"> / {r.budget !== null ? formatWon(r.budget) : "예산 없음"}</span>
                  </span>
                </div>
                {r.budget ? (
                  <div className="mt-1">
                    <Meter value={r.spent} max={r.budget} kind="limit" label={`${r.name} 예산 사용`} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ShareCard({ items }: { items: ShareItem[] }) {
  const max = Math.max(...items.map((i) => i.ratio), 0);
  return (
    <section className={`p-5 ${cardClass}`}>
      <h2 className="font-semibold">저축·지출 비중</h2>
      <p className="text-xs text-muted">저축과 지출을 합친 금액 중 대분류별 비율 (2% 이하는 그 외)</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">아직 지출이 없어요.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.name} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-sm" title={`${i.name} ${formatWon(i.amount)}원 (${formatPercent(i.ratio)})`}>
              <span className="truncate">{i.name}</span>
              <span className="h-3 rounded-r-full" aria-hidden>
                <span
                  className={`block h-full rounded-r ${i.other ? "bg-muted/40" : "bg-accent"}`}
                  style={{ width: `${Math.max((i.ratio / max) * 100, 2)}%` }}
                />
              </span>
              <span className="text-right text-muted tabular-nums">{formatPercent(i.ratio, 0)}</span>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">금액 표로 보기</summary>
          <table className="mt-2 w-full">
            <tbody>
              {items.map((i) => (
                <tr key={i.name} className="border-t border-border">
                  <td className="py-1">{i.name}</td>
                  <td className="py-1 text-right tabular-nums">{formatWon(i.amount)}</td>
                  <td className="py-1 text-right text-muted tabular-nums">{formatPercent(i.ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </section>
  );
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

function NoSpendCard({ month, cells, today }: { month: string; cells: Map<string, DayCell>; today: string }) {
  const count = [...cells.values()].filter((c) => c.noSpend).length;
  return (
    <section className={`p-5 ${cardClass}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">무지출 Day</h2>
        <span className="text-sm">
          <span className="font-semibold text-accent">{count}일</span>
          <span className="text-muted"> (고정지출 제외)</span>
        </span>
      </div>
      <table className="mt-3 w-full table-fixed text-center text-sm">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} className="pb-1 text-xs font-normal text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(month).map((week, i) => (
            <tr key={i}>
              {week.map((date, j) => {
                const cell = date ? cells.get(date) : null;
                return (
                  <td key={j} className="p-0.5">
                    {date ? (
                      <span
                        className={`flex h-9 items-center justify-center rounded-lg ${
                          cell?.noSpend ? "bg-accent/20 font-semibold text-accent" : date > today ? "text-muted/60" : ""
                        } ${date === today ? "ring-1 ring-foreground/40" : ""}`}
                        aria-label={cell?.noSpend ? `${Number(date.slice(8))}일 무지출` : undefined}
                      >
                        {Number(date.slice(8))}
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AmountList({ title, items, empty }: { title: string; items: NamedAmount[]; empty: string }) {
  return (
    <section className={`p-5 ${cardClass}`}>
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between py-2 text-sm">
              <span>{i.name}</span>
              <span className="tabular-nums">{formatWon(i.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DueCard({ due, month }: { due: DuePayment[]; month: string }) {
  const pending = due.filter((p) => p.status !== "entered");
  if (pending.length === 0) return null;
  const overdue = pending.filter((p) => p.status === "overdue" || p.status === "today");
  return (
    <section className={`p-5 ${cardClass}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">결제 예정</h2>
        <Link href={`/assets/payments?month=${month}`} className="text-sm text-muted">
          결제일 관리
        </Link>
      </div>
      {overdue.length > 0 ? (
        <p className="mt-1 text-sm text-danger">▲ 결제일이 지났거나 오늘인데 아직 입력하지 않은 결제가 {overdue.length}건 있어요.</p>
      ) : null}
      <ul className="mt-2 divide-y divide-border">
        {pending.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              {p.content}
              <span className="text-muted"> · {formatDateLabel(p.date)}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="tabular-nums">{formatWon(p.amount)}</span>
              <span className={`text-xs ${p.status === "upcoming" ? "text-muted" : "font-semibold text-danger"}`}>
                {p.status === "upcoming" ? `D-${p.daysLeft}` : p.status === "today" ? "오늘" : "지남"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {pending.length > 5 ? <p className="mt-1 text-xs text-muted">외 {pending.length - 5}건</p> : null}
    </section>
  );
}

function OverspendCard({ alerts, month }: { alerts: OverspendAlert[]; month: string }) {
  if (alerts.length === 0) return null;
  return (
    <section className={`p-5 ${cardClass}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">과소비 알림</h2>
        <Link href={`/budget?month=${month}`} className="text-sm text-muted">
          한도 설정
        </Link>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {alerts.map((a) => (
          <li key={`${a.type}:${a.id}`} className="py-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0">
                {a.name}
                {a.kind === "over_limit" ? <span className="ml-1.5 text-xs font-semibold whitespace-nowrap text-danger">▲ 한도 초과</span> : null}
                {a.kind === "near_limit" ? <span className="ml-1.5 text-xs font-semibold whitespace-nowrap text-warning">● 한도 80% 넘음</span> : null}
                {a.kind === "above_average" ? <span className="ml-1.5 text-xs font-semibold whitespace-nowrap text-warning">▲ 평소보다 많음</span> : null}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatWon(a.spent)}</span>
            </div>
            <p className="text-xs text-muted tabular-nums">
              {a.limit !== undefined
                ? a.spent > a.limit
                  ? `한도 ${formatWon(a.limit)} · ${formatWon(a.spent - a.limit)} 초과`
                  : `한도 ${formatWon(a.limit)} · ${formatWon(a.limit - a.spent)} 남음`
                : `지난 3개월 평균 ${formatWon(a.average ?? 0)} · ${formatWon(a.spent - (a.average ?? 0))} 더 씀`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
