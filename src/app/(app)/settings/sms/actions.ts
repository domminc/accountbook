"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { inboundTokenHash, newInboundToken } from "@/lib/data/inbound";

export type TokenState = { error?: string; token?: string; name?: string };

/** 기기용 토큰을 만든다. 원문은 이번 한 번만 돌려준다. */
export async function createInboundToken(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const m = await requireHousehold();
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 30) return { error: "기기 이름을 30자 이하로 입력해 주세요." };
  const token = newInboundToken();
  try {
    await withUser(m.userId, async (tx) => {
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from public.inbound_tokens where household_id = ${m.householdId}`;
      if (n >= 10) throw new Error("limit");
      await tx`
        insert into public.inbound_tokens (household_id, user_id, name, token_hash)
        values (${m.householdId}, ${m.userId}, ${name}, ${inboundTokenHash(token)})
      `;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "limit") return { error: "기기는 10개까지 등록할 수 있어요." };
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/settings/sms");
  return { token, name };
}

export async function revokeInboundToken(id: string): Promise<{ error?: string }> {
  const m = await requireHousehold();
  try {
    await withUser(m.userId, (tx) => tx`delete from public.inbound_tokens where id = ${id} and household_id = ${m.householdId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/settings/sms");
  return {};
}
