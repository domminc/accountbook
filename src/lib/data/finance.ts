import type { Tx } from "@/lib/db";
import type { RecordKind } from "@/lib/records";
import type { AssetItem, AssetSection, Snapshot } from "@/lib/finance";

export type RecordRow = { id: string } & Record<string, unknown>;

export async function loadRecords(tx: Tx, householdId: string, kind: RecordKind): Promise<RecordRow[]> {
  return tx<RecordRow[]>`select * from ${tx(kind)} where household_id = ${householdId} order by sort_order, created_at`;
}

export type RepaymentRow = { id: string; loanId: string; paidOn: string; principal: number; interest: number; note: string | null };

export async function loadRepayments(tx: Tx, householdId: string): Promise<RepaymentRow[]> {
  const rows = await tx<{ id: string; loan_id: string; paid_on: string; principal: number; interest: number; note: string | null }[]>`
    select id, loan_id, paid_on, principal, interest, note from public.loan_repayments
    where household_id = ${householdId} order by paid_on desc, created_at desc
  `;
  return rows.map((r) => ({ id: r.id, loanId: r.loan_id, paidOn: r.paid_on, principal: r.principal, interest: r.interest, note: r.note }));
}

export async function loadAssetItems(tx: Tx, householdId: string): Promise<AssetItem[]> {
  const rows = await tx<{ id: string; section: AssetSection; group_name: string; name: string; sort_order: number; is_hidden: boolean }[]>`
    select id, section, group_name, name, sort_order, is_hidden from public.asset_items
    where household_id = ${householdId} order by sort_order, created_at
  `;
  return rows.map((r) => ({ id: r.id, section: r.section, groupName: r.group_name, name: r.name, sortOrder: r.sort_order, isHidden: r.is_hidden }));
}

export async function loadSnapshots(tx: Tx, householdId: string, range: { start: string; end: string }): Promise<Snapshot[]> {
  const rows = await tx<{ asset_item_id: string; period: string; amount: number }[]>`
    select asset_item_id, period, amount from public.asset_snapshots
    where household_id = ${householdId} and period between ${range.start} and ${range.end}
  `;
  return rows.map((r) => ({ itemId: r.asset_item_id, month: r.period.slice(0, 7), amount: r.amount }));
}
