"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { isValidMonth } from "@/lib/month";
import { dueDate } from "@/lib/finance";
import type { ActionState } from "@/lib/action-state";

/** 고른 결제일 항목을 그 달 거래로 입력 (이미 입력한 항목은 건너뜀) */
export async function enterPayments(month: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const m = await requireHousehold();
  if (!isValidMonth(month)) return { error: "월을 확인해 주세요." };
  const ids = z.array(z.uuid()).max(200).safeParse(formData.getAll("ids"));
  if (!ids.success || ids.data.length === 0) return { error: "입력할 결제를 골라 주세요." };

  try {
    await withUser(m.userId, async (tx) => {
      const rules = await tx<{ id: string; content: string; category_id: string | null; amount: number; pay_day: number; payment_method_id: string | null }[]>`
        select r.id, r.content, r.category_id, r.amount, r.pay_day, r.payment_method_id
        from public.recurring_payments r
        where r.household_id = ${m.householdId} and r.id in ${tx(ids.data)} and r.category_id is not null
          and not exists (
            select 1 from public.transactions t
            where t.recurring_payment_id = r.id and t.occurred_on between ${`${month}-01`} and ${dueDate(31, month)}
          )
      `;
      for (const r of rules) {
        await tx`
          insert into public.transactions (household_id, occurred_on, amount, category_id, payment_method_id, memo, created_by, recurring_payment_id)
          values (${m.householdId}, ${dueDate(r.pay_day, month)}, ${r.amount}, ${r.category_id}, ${r.payment_method_id}, ${r.content}, ${m.userId}, ${r.id})
        `;
      }
    });
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  redirect(`/assets/payments?month=${month}`);
}
