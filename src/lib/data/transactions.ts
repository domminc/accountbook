import type { Tx } from "@/lib/db";
import { txKindOf, type CategoryKind, type TxKind } from "./settings";

export type TransactionRow = {
  id: string;
  occurredOn: string;
  amount: number;
  memo: string | null;
  categoryId: string | null;
  categoryName: string | null;
  groupId: string | null;
  groupName: string | null;
  groupKind: CategoryKind | null;
  /** 미분류(가져온 거래)는 null */
  kind: TxKind | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  tags: { id: string; name: string }[];
  createdBy: string | null;
  creatorName: string | null;
};

export type TransactionFilters = {
  groupId?: string;
  categoryId?: string;
  paymentMethodId?: string;
  tagId?: string;
  createdBy?: string;
  query?: string;
  uncategorized?: boolean;
};

type Row = {
  id: string;
  occurred_on: string;
  amount: number;
  memo: string | null;
  category_id: string | null;
  category_name: string | null;
  group_id: string | null;
  group_name: string | null;
  group_kind: CategoryKind | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  tags: { id: string; name: string }[];
  created_by: string | null;
  creator_name: string | null;
};

function toRow(r: Row): TransactionRow {
  return {
    id: r.id,
    occurredOn: r.occurred_on,
    amount: r.amount,
    memo: r.memo,
    categoryId: r.category_id,
    categoryName: r.category_name,
    groupId: r.group_id,
    groupName: r.group_name,
    groupKind: r.group_kind,
    kind: r.group_kind ? txKindOf(r.group_kind) : null,
    paymentMethodId: r.payment_method_id,
    paymentMethodName: r.payment_method_name,
    tags: r.tags,
    createdBy: r.created_by,
    creatorName: r.creator_name,
  };
}

function selectTransactions(tx: Tx) {
  return tx`
    select t.id, t.occurred_on, t.amount, t.memo, t.created_by,
      c.id as category_id, c.name as category_name,
      g.id as group_id, g.name as group_name, g.kind as group_kind,
      pm.id as payment_method_id, pm.name as payment_method_name,
      m.display_name as creator_name,
      coalesce(
        (select json_agg(json_build_object('id', tg.id, 'name', tg.name) order by tg.sort_order)
         from public.transaction_tags tt join public.tags tg on tg.id = tt.tag_id
         where tt.transaction_id = t.id),
        '[]'::json
      ) as tags
    from public.transactions t
    left join public.categories c on c.id = t.category_id
    left join public.category_groups g on g.id = c.group_id
    left join public.payment_methods pm on pm.id = t.payment_method_id
    left join public.members m on m.user_id = t.created_by and m.household_id = t.household_id
  `;
}

/** 기간 안의 거래 (최근 날짜 먼저) */
export async function listTransactions(
  tx: Tx,
  householdId: string,
  range: { start: string; end: string },
  f: TransactionFilters = {},
): Promise<TransactionRow[]> {
  const empty = tx``;
  const rows = await tx<Row[]>`
    ${selectTransactions(tx)}
    where t.household_id = ${householdId}
      and t.occurred_on between ${range.start} and ${range.end}
      ${f.groupId ? tx`and g.id = ${f.groupId}` : empty}
      ${f.categoryId ? tx`and c.id = ${f.categoryId}` : empty}
      ${f.paymentMethodId ? tx`and t.payment_method_id = ${f.paymentMethodId}` : empty}
      ${f.createdBy ? tx`and t.created_by = ${f.createdBy}` : empty}
      ${f.uncategorized ? tx`and t.category_id is null` : empty}
      ${f.tagId ? tx`and exists (select 1 from public.transaction_tags x where x.transaction_id = t.id and x.tag_id = ${f.tagId})` : empty}
      ${f.query ? tx`and t.memo ilike ${"%" + escapeLike(f.query) + "%"}` : empty}
    order by t.occurred_on desc, t.created_at desc
  `;
  return rows.map(toRow);
}

export async function getTransaction(tx: Tx, householdId: string, id: string): Promise<TransactionRow | null> {
  const rows = await tx<Row[]>`
    ${selectTransactions(tx)}
    where t.household_id = ${householdId} and t.id = ${id}
  `;
  return rows[0] ? toRow(rows[0]) : null;
}

/** 이 사용자가 마지막으로 쓴 지출방법 (새 거래 기본값) */
export async function lastPaymentMethodId(tx: Tx, householdId: string, userId: string): Promise<string | null> {
  const [row] = await tx<{ payment_method_id: string }[]>`
    select t.payment_method_id from public.transactions t
    join public.payment_methods pm on pm.id = t.payment_method_id and not pm.is_hidden
    where t.household_id = ${householdId} and t.created_by = ${userId}
    order by t.created_at desc
    limit 1
  `;
  return row?.payment_method_id ?? null;
}

export type Totals = { income: number; saving: number; expense: number; uncategorized: number };

export function sumByKind(rows: TransactionRow[]): Totals {
  const totals: Totals = { income: 0, saving: 0, expense: 0, uncategorized: 0 };
  for (const r of rows) totals[r.kind ?? "uncategorized"] += r.amount;
  return totals;
}

/** 날짜별로 묶는다 (입력 순서 유지) */
export function groupByDate(rows: TransactionRow[]): { date: string; rows: TransactionRow[] }[] {
  const groups: { date: string; rows: TransactionRow[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === r.occurredOn) last.rows.push(r);
    else groups.push({ date: r.occurredOn, rows: [r] });
  }
  return groups;
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
