import type { Tx } from "@/lib/db";
import type { SpendingLimit } from "@/lib/overspend";
import type { CategoryGroup, SimpleItem } from "@/lib/data/settings";

export type GoalKind = "income" | "saving" | "expense";
export type Goal = { amount: number; note: string | null };
export type Goals = Record<GoalKind, Goal | null>;
export type MonthEvent = { id: string; occurredOn: string; budget: number | null; content: string };

/** 'YYYY-MM' → 그 달 1일 (budgets·goals 의 period) */
export const periodOf = (month: string) => `${month}-01`;

export async function loadBudgets(tx: Tx, householdId: string, month: string): Promise<Map<string, number>> {
  const rows = await tx<{ group_id: string; amount: number }[]>`
    select group_id, amount from public.budgets
    where household_id = ${householdId} and period = ${periodOf(month)}
  `;
  return new Map(rows.map((r) => [r.group_id, r.amount]));
}

export async function loadGoals(tx: Tx, householdId: string, month: string): Promise<Goals> {
  const rows = await tx<{ kind: GoalKind; amount: number; note: string | null }[]>`
    select kind, amount, note from public.goals
    where household_id = ${householdId} and period = ${periodOf(month)}
  `;
  const goals: Goals = { income: null, saving: null, expense: null };
  for (const r of rows) goals[r.kind] = { amount: r.amount, note: r.note };
  return goals;
}

export async function loadEvents(tx: Tx, householdId: string, range: { start: string; end: string }): Promise<MonthEvent[]> {
  const rows = await tx<{ id: string; occurred_on: string; budget: number | null; content: string }[]>`
    select id, occurred_on, budget, content from public.month_events
    where household_id = ${householdId} and occurred_on between ${range.start} and ${range.end}
    order by occurred_on, created_at
  `;
  return rows.map((r) => ({ id: r.id, occurredOn: r.occurred_on, budget: r.budget, content: r.content }));
}

/** 기간 안의 예비비 지출 (캘린더용) */
export async function loadReserveOut(
  tx: Tx,
  householdId: string,
  range: { start: string; end: string },
): Promise<{ occurredOn: string; amount: number }[]> {
  const rows = await tx<{ occurred_on: string; amount: number }[]>`
    select occurred_on, amount from public.reserve_entries
    where household_id = ${householdId} and direction = 'out' and occurred_on between ${range.start} and ${range.end}
  `;
  return rows.map((r) => ({ occurredOn: r.occurred_on, amount: r.amount }));
}

export async function loadSpendingLimits(tx: Tx, householdId: string): Promise<(SpendingLimit & { limitId: string })[]> {
  const rows = await tx<{ id: string; category_id: string | null; tag_id: string | null; amount: number }[]>`
    select id, category_id, tag_id, amount from public.spending_limits
    where household_id = ${householdId} order by created_at
  `;
  return rows.map((r) => ({
    limitId: r.id,
    type: r.category_id ? "category" : "tag",
    id: (r.category_id ?? r.tag_id)!,
    amount: r.amount,
  }));
}

/** 과소비 알림에 보일 이름: "category:<id>" → "대분류 · 소분류", "tag:<id>" → "#태그" */
export function limitTargetNames(groups: CategoryGroup[], tags: SimpleItem[]): Map<string, string> {
  return new Map([
    ...groups.flatMap((g) => g.categories.map((c) => [`category:${c.id}`, `${g.name} · ${c.name}`] as const)),
    ...tags.map((t) => [`tag:${t.id}`, `#${t.name}`] as const),
  ]);
}
