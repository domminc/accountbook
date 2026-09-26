"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, withUser, type Tx } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { isValidDate } from "@/lib/month";
import { parseAmount } from "@/lib/money";
import { moveInOrder } from "@/lib/data/settings";
import { firstError, nameSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

async function run(fn: (tx: Tx, householdId: string, userId: string) => Promise<string | void>): Promise<ActionState> {
  const m = await requireHousehold();
  try {
    const error = await withUser(m.userId, (tx) => fn(tx, m.householdId, m.userId));
    if (error) return { error };
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {};
}

const noteOf = (formData: FormData) => String(formData.get("note") ?? "").trim().slice(0, 200) || null;

export async function addReserveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = nameSchema("분류 이름").safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: firstError(name.error) };
  return run(async (tx, hid) => {
    const [{ next }] = await tx<{ next: number }[]>`
      select coalesce(max(sort_order), -1) + 1 as next from public.reserve_categories where household_id = ${hid}
    `;
    await tx`insert into public.reserve_categories (household_id, name, note, sort_order) values (${hid}, ${name.data}, ${noteOf(formData)}, ${next})`;
  });
}

export async function renameReserveCategory(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = nameSchema("분류 이름").safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: firstError(name.error) };
  return run(async (tx, hid) => {
    await tx`update public.reserve_categories set name = ${name.data} where id = ${id} and household_id = ${hid}`;
  });
}

export async function setReserveNote(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async (tx, hid) => {
    await tx`update public.reserve_categories set note = ${noteOf(formData)} where id = ${id} and household_id = ${hid}`;
  });
}

export async function moveReserveCategory(id: string, dir: -1 | 1): Promise<ActionState> {
  return run(async (tx, hid) => {
    const rows = await tx<{ id: string }[]>`
      select id from public.reserve_categories where household_id = ${hid} order by sort_order, created_at
    `;
    for (const [i, rid] of moveInOrder(rows.map((r) => r.id), id, dir).entries()) {
      await tx`update public.reserve_categories set sort_order = ${i} where id = ${rid}`;
    }
  });
}

export async function deleteReserveCategory(id: string): Promise<ActionState> {
  // 입금·지출 내역에 쓴 분류는 FK가 막는다
  return run(async (tx, hid) => {
    await tx`delete from public.reserve_categories where id = ${id} and household_id = ${hid}`;
  });
}

const entrySchema = z.object({
  occurredOn: z.string().refine(isValidDate, "날짜를 확인해 주세요."),
  amount: z
    .string()
    .transform(parseAmount)
    .refine((v): v is number => v !== null, "금액을 1원 ~ 1조 원 사이로 입력해 주세요."),
  categoryId: z.uuid({ error: "분류를 골라 주세요." }),
  memo: z.string().trim().max(200, "내용은 200자 이하로 입력해 주세요.").transform((v) => v || null),
});

export async function addReserveEntry(direction: "in" | "out", year: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (direction !== "in" && direction !== "out") return { error: "구분을 확인해 주세요." };
  const parsed = entrySchema.safeParse({
    occurredOn: formData.get("occurredOn") ?? "",
    amount: formData.get("amount") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    memo: formData.get("memo") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  if (!v.occurredOn.startsWith(`${year}-`)) return { error: `${year}년 날짜를 입력해 주세요.` };
  const note = direction === "out" ? noteOf(formData) : null;

  const result = await run(async (tx, hid, uid) => {
    await tx`
      insert into public.reserve_entries (household_id, direction, occurred_on, amount, reserve_category_id, memo, note, created_by)
      values (${hid}, ${direction}, ${v.occurredOn}, ${v.amount}, ${v.categoryId}, ${v.memo}, ${note}, ${uid})
    `;
  });
  return result.error ? result : { savedAt: Date.now() };
}

export async function deleteReserveEntry(id: string): Promise<ActionState> {
  return run(async (tx, hid) => {
    await tx`delete from public.reserve_entries where id = ${id} and household_id = ${hid}`;
  });
}
