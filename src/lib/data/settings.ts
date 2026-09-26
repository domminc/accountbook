import type { Tx } from "@/lib/db";

export type CategoryKind = "income" | "saving" | "fixed_expense" | "variable_expense";
export type TxKind = "income" | "saving" | "expense";

export const KIND_LABEL: Record<CategoryKind, string> = {
  income: "수입",
  saving: "저축",
  fixed_expense: "고정지출",
  variable_expense: "비고정지출",
};

export const TX_KIND_LABEL: Record<TxKind, string> = { income: "수입", saving: "저축", expense: "지출" };

export function txKindOf(kind: CategoryKind): TxKind {
  return kind === "income" ? "income" : kind === "saving" ? "saving" : "expense";
}

export type Category = { id: string; name: string; sortOrder: number; isHidden: boolean };
export type CategoryGroup = {
  id: string;
  name: string;
  kind: CategoryKind;
  sortOrder: number;
  isHidden: boolean;
  categories: Category[];
};
export type SimpleItem = { id: string; name: string; sortOrder: number; isHidden: boolean };
export type Member = { userId: string; displayName: string };

/** 대분류·소분류 (숨김 포함, 정렬 순서대로) */
export async function loadCategoryGroups(tx: Tx, householdId: string): Promise<CategoryGroup[]> {
  const rows = await tx<
    {
      id: string;
      name: string;
      kind: CategoryKind;
      sort_order: number;
      is_hidden: boolean;
      categories: { id: string; name: string; sort_order: number; is_hidden: boolean }[];
    }[]
  >`
    select g.id, g.name, g.kind, g.sort_order, g.is_hidden,
      coalesce(
        (select json_agg(json_build_object('id', c.id, 'name', c.name, 'sort_order', c.sort_order, 'is_hidden', c.is_hidden)
                         order by c.sort_order, c.created_at)
         from public.categories c where c.group_id = g.id),
        '[]'::json
      ) as categories
    from public.category_groups g
    where g.household_id = ${householdId}
    order by g.sort_order, g.created_at
  `;
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind,
    sortOrder: g.sort_order,
    isHidden: g.is_hidden,
    categories: g.categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order, isHidden: c.is_hidden })),
  }));
}

export type SimpleTable = "payment_methods" | "tags";

export async function loadSimpleItems(tx: Tx, householdId: string, table: SimpleTable): Promise<SimpleItem[]> {
  const rows = await tx<{ id: string; name: string; sort_order: number; is_hidden: boolean }[]>`
    select id, name, sort_order, is_hidden from ${tx(table)}
    where household_id = ${householdId}
    order by sort_order, created_at
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order, isHidden: r.is_hidden }));
}

export async function loadMembers(tx: Tx, householdId: string): Promise<Member[]> {
  const rows = await tx<{ user_id: string; display_name: string }[]>`
    select user_id, display_name from public.members
    where household_id = ${householdId}
    order by created_at
  `;
  return rows.map((r) => ({ userId: r.user_id, displayName: r.display_name }));
}

/** ids 목록에서 id를 한 칸 위(-1)나 아래(+1)로 옮긴 새 순서. 끝이면 그대로. */
export function moveInOrder(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
