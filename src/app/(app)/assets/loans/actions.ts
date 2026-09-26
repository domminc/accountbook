"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { isValidDate } from "@/lib/month";
import { MAX_AMOUNT } from "@/lib/money";
import type { ActionState } from "@/lib/action-state";

const amountOf = (formData: FormData, key: string) => {
  const raw = String(formData.get(key) ?? "").replace(/[^\d]/g, "");
  return raw ? Number(raw) : 0;
};

export async function addRepayment(loanId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const m = await requireHousehold();
  const paidOn = String(formData.get("paidOn") ?? "");
  if (!isValidDate(paidOn)) return { error: "날짜를 확인해 주세요." };
  const principal = amountOf(formData, "principal");
  const interest = amountOf(formData, "interest");
  if (principal > MAX_AMOUNT || interest > MAX_AMOUNT) return { error: "금액을 확인해 주세요." };
  if (principal === 0 && interest === 0) return { error: "상환원금이나 이자를 입력해 주세요." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  try {
    await withUser(m.userId, (tx) => tx`
      insert into public.loan_repayments (household_id, loan_id, paid_on, principal, interest, note)
      values (${m.householdId}, ${loanId}, ${paidOn}, ${principal}, ${interest}, ${note})
    `);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/assets/loans");
  return { savedAt: Date.now() };
}

export async function deleteRepayment(id: string): Promise<ActionState> {
  const m = await requireHousehold();
  try {
    await withUser(m.userId, (tx) => tx`delete from public.loan_repayments where id = ${id} and household_id = ${m.householdId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/assets/loans");
  return {};
}
