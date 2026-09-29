"use server";

import { redirect } from "next/navigation";
import { requireUserId, endSession } from "@/lib/auth";
import { checkCurrentPassword } from "@/lib/account";
import { withUser } from "@/lib/db";

export type DeleteAccountState = { error?: string };

/** 회원 탈퇴. 비밀번호를 다시 확인하고, 계정(혼자 쓰던 가계부면 가계부 데이터까지)을 지운 뒤 로그아웃한다. */
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const userId = await requireUserId();
  if (formData.get("confirm") !== "yes") return { error: "안내를 확인했다고 체크해 주세요." };
  if (!(await checkCurrentPassword(userId, String(formData.get("password") ?? "")))) {
    return { error: "비밀번호가 맞지 않아요." };
  }
  try {
    await withUser(userId, (tx) => tx`select public.delete_my_account()`);
  } catch (e) {
    console.error(e);
    return { error: "탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  await endSession();
  redirect("/login?deleted=1");
}
