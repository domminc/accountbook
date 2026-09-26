"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { INVITE_DAYS, inviteTokenHash, newInviteToken } from "@/lib/invite";
import { firstError, nameSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export type InviteState = ActionState & { link?: string };

export async function createInvite(): Promise<InviteState> {
  const m = await requireHousehold();
  const token = newInviteToken();
  try {
    await withUser(m.userId, (tx) => tx`
      insert into public.household_invites (household_id, token_hash, created_by, expires_at)
      values (${m.householdId}, ${inviteTokenHash(token)}, ${m.userId}, now() + ${`${INVITE_DAYS} days`}::interval)
    `);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  revalidatePath("/settings/members");
  return { link: `${proto}://${host}/invite/${token}` };
}

export async function revokeInvite(id: string): Promise<ActionState> {
  const m = await requireHousehold();
  try {
    await withUser(m.userId, (tx) => tx`delete from public.household_invites where id = ${id} and household_id = ${m.householdId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/settings/members");
  return {};
}

export async function updateDisplayName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const m = await requireHousehold();
  const name = nameSchema("이름").safeParse(formData.get("displayName") ?? "");
  if (!name.success) return { error: firstError(name.error) };
  try {
    await withUser(m.userId, (tx) => tx`update public.members set display_name = ${name.data} where user_id = ${m.userId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { savedAt: Date.now(), message: "저장했어요." };
}
