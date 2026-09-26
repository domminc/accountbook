"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { RECEIPTS_PER_TRANSACTION } from "@/lib/receipt";
import { insertReceipts, readReceiptFiles } from "@/lib/data/receipts";
import type { ActionState } from "@/lib/action-state";

export async function addReceipts(transactionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const m = await requireHousehold();
  const read = await readReceiptFiles(formData);
  if ("error" in read) return { error: read.error };
  if (read.files.length === 0) return { error: "사진을 골라 주세요." };
  try {
    const ok = await withUser(m.userId, async (tx) => {
      const [t] = await tx`select 1 from public.transactions where id = ${transactionId} and household_id = ${m.householdId}`;
      if (!t) return null;
      return insertReceipts(tx, m.householdId, m.userId, transactionId, read.files);
    });
    if (ok === null) return { error: "거래를 찾을 수 없어요." };
    if (!ok) return { error: `영수증은 거래 하나에 ${RECEIPTS_PER_TRANSACTION}장까지예요.` };
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}

export async function deleteReceipt(id: string): Promise<ActionState> {
  const m = await requireHousehold();
  try {
    await withUser(m.userId, (tx) => tx`delete from public.transaction_receipts where id = ${id} and household_id = ${m.householdId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {};
}
