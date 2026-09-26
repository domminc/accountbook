"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { dbErrorMessage, withUser } from "@/lib/db";
import { firstError, nameSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function acceptInvite(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const name = nameSchema("내 이름").safeParse(formData.get("displayName") ?? "");
  if (!name.success) return { error: firstError(name.error) };
  try {
    await withUser(userId, (tx) => tx`select public.accept_invite(${token}, ${name.data})`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  redirect("/");
}
