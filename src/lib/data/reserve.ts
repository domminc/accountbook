import type { Tx } from "@/lib/db";

export type ReserveCategory = { id: string; name: string; note: string | null; sortOrder: number };
export type ReserveEntry = {
  id: string;
  direction: "in" | "out";
  occurredOn: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  memo: string | null;
  note: string | null;
};

export async function loadReserveCategories(tx: Tx, householdId: string): Promise<ReserveCategory[]> {
  const rows = await tx<{ id: string; name: string; note: string | null; sort_order: number }[]>`
    select id, name, note, sort_order from public.reserve_categories
    where household_id = ${householdId} order by sort_order, created_at
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, note: r.note, sortOrder: r.sort_order }));
}

export async function loadReserveEntries(tx: Tx, householdId: string, range: { start: string; end: string }): Promise<ReserveEntry[]> {
  const rows = await tx<
    { id: string; direction: "in" | "out"; occurred_on: string; amount: number; reserve_category_id: string; category_name: string; memo: string | null; note: string | null }[]
  >`
    select e.id, e.direction, e.occurred_on, e.amount, e.reserve_category_id, c.name as category_name, e.memo, e.note
    from public.reserve_entries e join public.reserve_categories c on c.id = e.reserve_category_id
    where e.household_id = ${householdId} and e.occurred_on between ${range.start} and ${range.end}
    order by e.occurred_on, e.created_at
  `;
  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    occurredOn: r.occurred_on,
    amount: r.amount,
    categoryId: r.reserve_category_id,
    categoryName: r.category_name,
    memo: r.memo,
    note: r.note,
  }));
}
