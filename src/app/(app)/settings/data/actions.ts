"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, withUser, type Tx } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { isValidDate, isValidMonth } from "@/lib/month";
import { MAX_AMOUNT } from "@/lib/money";
import type { ImportData } from "@/lib/import/sheet";
import type { ActionState } from "@/lib/action-state";

const name = z.string().trim().min(1).max(30);
const date = z.string().refine(isValidDate);
const month = z.string().refine(isValidMonth);
const amount = z.number().int().min(1).max(MAX_AMOUNT);
const text = (max: number) => z.string().max(max).nullable();
const kind = z.enum(["income", "saving", "fixed_expense", "variable_expense"]);

const schema = z.object({
  year: z.number().int().min(2000).max(2100),
  version: z.string().nullable(),
  groups: z.array(z.object({ name, kind, categories: z.array(name).max(100) })).max(100),
  paymentMethods: z.array(name).max(50),
  tags: z.array(name).max(50),
  transactions: z
    .array(
      z.object({
        date,
        amount,
        memo: text(200),
        group: name.nullable(),
        category: name.nullable(),
        paymentMethod: name.nullable(),
        tag: name.nullable(),
      }),
    )
    .max(20000),
  budgets: z.array(z.object({ month, group: name, amount: z.number().int().min(0).max(MAX_AMOUNT) })).max(2000),
  goals: z.array(z.object({ month, kind: z.enum(["income", "saving", "expense"]), amount: z.number().int().min(0).max(MAX_AMOUNT), note: text(500) })).max(100),
  events: z.array(z.object({ date, budget: z.number().int().min(0).max(MAX_AMOUNT).nullable(), content: z.string().min(1).max(200) })).max(1000),
  reserve: z.object({
    categories: z.array(z.object({ name, note: text(200) })).max(50),
    ins: z.array(z.object({ date, amount, category: name, memo: text(200) })).max(5000),
    outs: z.array(z.object({ date, amount, category: name, memo: text(200), note: text(200) })).max(5000),
  }),
  warnings: z.array(z.string()),
});

export type ImportResult = ActionState & { needsReplace?: boolean; summary?: string };

/** 가져오기. 같은 연도를 이미 가져왔으면 replace=1 일 때만 이전 가져오기를 지우고 다시 넣는다. */
export async function importSheet(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  const m = await requireHousehold();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "파일을 다시 골라 주세요." };
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { error: "시트 내용을 읽지 못했어요. 디어나 가계부 시트인지 확인해 주세요." };
  const data = parsed.data as ImportData;
  const replace = formData.get("replace") === "1";
  const fileName = String(formData.get("fileName") ?? "시트").slice(0, 200);

  try {
    const result = await withUser(m.userId, async (tx) => {
      const existing = await tx<{ id: string }[]>`
        select id from public.import_batches where household_id = ${m.householdId} and year = ${data.year}
      `;
      if (existing.length > 0 && !replace) return { needsReplace: true } as const;
      if (existing.length > 0) {
        // 이전 가져오기의 거래·예비비·이벤트는 FK cascade로 함께 지워진다
        await tx`delete from public.import_batches where household_id = ${m.householdId} and year = ${data.year}`;
      }
      return { summary: await applyImport(tx, m.householdId, m.userId, data, fileName) } as const;
    });
    if ("needsReplace" in result) {
      return { needsReplace: true, error: `${data.year}년 시트를 이미 가져왔어요. 다시 가져오면 그때 가져온 거래·예비비를 지우고 새로 넣어요.` };
    }
    revalidatePath("/", "layout");
    return { savedAt: Date.now(), message: "가져왔어요.", summary: result.summary };
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
}

async function applyImport(tx: Tx, hid: string, userId: string, data: ImportData, fileName: string): Promise<string> {
  const [batch] = await tx<{ id: string }[]>`
    insert into public.import_batches (household_id, file_name, year, summary, created_by)
    values (${hid}, ${fileName}, ${data.year}, ${tx.json({ version: data.version, transactions: data.transactions.length })}, ${userId})
    returning id
  `;

  // ── 대분류·소분류: 이름으로 찾고 없으면 추가. 수입·저축·고정지출은 종류로 찾는다. ──
  const groups = await tx<{ id: string; name: string; kind: string }[]>`
    select id, name, kind from public.category_groups where household_id = ${hid}
  `;
  let nextGroupOrder = groups.length + 3;
  const groupId = new Map<string, string>(); // 시트 대분류 이름 → id
  for (const g of data.groups) {
    const found =
      g.kind === "variable_expense" ? groups.find((x) => x.name === g.name) : groups.find((x) => x.kind === g.kind);
    if (found) {
      groupId.set(g.name, found.id);
      continue;
    }
    const [row] = await tx<{ id: string }[]>`
      insert into public.category_groups (household_id, kind, name, sort_order)
      values (${hid}, 'variable_expense', ${g.name}, ${nextGroupOrder++})
      returning id
    `;
    groupId.set(g.name, row.id);
  }

  const cats = await tx<{ id: string; group_id: string; name: string }[]>`
    select id, group_id, name from public.categories where household_id = ${hid}
  `;
  const catKey = (gid: string, n: string) => `${gid}\u0000${n}`;
  const categoryId = new Map(cats.map((c) => [catKey(c.group_id, c.name), c.id]));
  for (const g of data.groups) {
    const gid = groupId.get(g.name)!;
    let order = cats.filter((c) => c.group_id === gid).length;
    for (const c of g.categories) {
      if (categoryId.has(catKey(gid, c))) continue;
      const [row] = await tx<{ id: string }[]>`
        insert into public.categories (household_id, group_id, name, sort_order)
        values (${hid}, ${gid}, ${c}, ${order++})
        returning id
      `;
      categoryId.set(catKey(gid, c), row.id);
    }
  }

  const upsertNames = async (table: "payment_methods" | "tags" | "reserve_categories", names: string[]) => {
    const rows = await tx<{ id: string; name: string }[]>`select id, name from ${tx(table)} where household_id = ${hid}`;
    const ids = new Map(rows.map((r) => [r.name, r.id]));
    let order = rows.length;
    for (const n of names) {
      if (ids.has(n)) continue;
      const [row] = await tx<{ id: string }[]>`
        insert into ${tx(table)} (household_id, name, sort_order) values (${hid}, ${n}, ${order++}) returning id
      `;
      ids.set(n, row.id);
    }
    return ids;
  };
  const pmIds = await upsertNames("payment_methods", data.paymentMethods);
  const tagIds = await upsertNames("tags", data.tags);

  // ── 거래 ──
  const kindOfGroup = new Map(data.groups.map((g) => [g.name, g.kind]));
  const txRows = data.transactions.map((t) => {
    const gid = t.group ? groupId.get(t.group) : undefined;
    const cid = gid && t.category ? categoryId.get(catKey(gid, t.category)) : undefined;
    const kind = t.group ? kindOfGroup.get(t.group) : undefined;
    const isExpense = kind === "fixed_expense" || kind === "variable_expense";
    return {
      id: randomUUID(),
      household_id: hid,
      occurred_on: t.date,
      amount: t.amount,
      category_id: cid ?? null,
      // 앱 규칙과 같이 지출에만 지출방법을 남긴다 (결제 수단별 합계도 지출만 센다)
      payment_method_id: isExpense && t.paymentMethod ? (pmIds.get(t.paymentMethod) ?? null) : null,
      memo: t.memo,
      import_batch_id: batch.id,
      created_by: userId,
    };
  });
  for (let i = 0; i < txRows.length; i += 500) {
    await tx`insert into public.transactions ${tx(txRows.slice(i, i + 500))}`;
  }
  const tagRows = data.transactions
    .map((t, i) => (t.tag && tagIds.get(t.tag) ? { transaction_id: txRows[i].id, tag_id: tagIds.get(t.tag)!, household_id: hid } : null))
    .filter((r) => r !== null);
  for (let i = 0; i < tagRows.length; i += 500) {
    await tx`insert into public.transaction_tags ${tx(tagRows.slice(i, i + 500))}`;
  }

  // ── 목표·예산 (같은 달은 덮어쓴다) ──
  for (const b of data.budgets) {
    const gid = groupId.get(b.group);
    if (!gid) continue;
    await tx`
      insert into public.budgets (household_id, period, group_id, amount)
      values (${hid}, ${`${b.month}-01`}, ${gid}, ${b.amount})
      on conflict (household_id, period, group_id) do update set amount = excluded.amount
    `;
  }
  for (const g of data.goals) {
    await tx`
      insert into public.goals (household_id, period, kind, amount, note)
      values (${hid}, ${`${g.month}-01`}, ${g.kind}, ${g.amount}, ${g.note})
      on conflict (household_id, period, kind) do update set amount = excluded.amount, note = excluded.note
    `;
  }
  for (const e of data.events) {
    await tx`
      insert into public.month_events (household_id, occurred_on, budget, content, import_batch_id)
      values (${hid}, ${e.date}, ${e.budget}, ${e.content}, ${batch.id})
    `;
  }

  // ── 예비비 ──
  const reserveIds = await upsertNames("reserve_categories", data.reserve.categories.map((c) => c.name));
  for (const c of data.reserve.categories) {
    if (c.note) await tx`update public.reserve_categories set note = ${c.note} where id = ${reserveIds.get(c.name)!}`;
  }
  const reserveRows = [
    ...data.reserve.ins.map((e) => ({ direction: "in", date: e.date, amount: e.amount, category: e.category, memo: e.memo, note: null as string | null })),
    ...data.reserve.outs.map((e) => ({ direction: "out", ...e })),
  ].map((e) => ({
    household_id: hid,
    direction: e.direction,
    occurred_on: e.date,
    amount: e.amount,
    reserve_category_id: reserveIds.get(e.category)!,
    memo: e.memo,
    note: e.note,
    import_batch_id: batch.id,
    created_by: userId,
  }));
  for (let i = 0; i < reserveRows.length; i += 500) {
    await tx`insert into public.reserve_entries ${tx(reserveRows.slice(i, i + 500))}`;
  }

  const uncategorized = txRows.filter((r) => !r.category_id).length;
  return [
    `거래 ${txRows.length}건${uncategorized ? ` (분류 필요 ${uncategorized}건)` : ""}`,
    `예비비 입금 ${data.reserve.ins.length}건 · 지출 ${data.reserve.outs.length}건`,
    `목표 ${data.goals.length}개 · 예산 ${data.budgets.length}개 · 이벤트 ${data.events.length}개`,
  ].join(", ");
}
