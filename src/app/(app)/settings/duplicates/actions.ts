"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";

/** 고른 중복 거래를 지운다 */
export async function deleteDuplicates(ids: string[]): Promise<{ error?: string; removed?: number }> {
  const parsed = z.array(z.uuid()).min(1, "지울 거래를 골라 주세요.").max(2000).safeParse(ids);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  const m = await requireHousehold();
  try {
    const removed = await withUser(m.userId, async (tx) => {
      const r = await tx`delete from public.transactions where household_id = ${m.householdId} and id in ${tx(parsed.data)}`;
      return r.count;
    });
    revalidatePath("/", "layout");
    return { removed };
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
}
