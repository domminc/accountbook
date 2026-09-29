"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { requireUserId } from "@/lib/auth";
import { checkCurrentPassword, setPassword } from "@/lib/account";
import { dbErrorMessage, withUser } from "@/lib/db";
import { passkeyRegistrationOptions, registerPasskey } from "@/lib/passkey";
import { firstError, passwordSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

/** 이 기기 등록 1단계: 기기에 보낼 challenge */
export async function startPasskeyRegistration(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return passkeyRegistrationOptions(await requireUserId());
}

/** 이 기기 등록 2단계: 기기가 만든 공개 키를 확인하고 저장 */
export async function finishPasskeyRegistration(response: RegistrationResponseJSON): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await registerPasskey(userId, response);
  if (result.error) return result;
  revalidatePath("/settings/account");
  return { message: "이 기기를 등록했어요. 다음부터 Face ID·지문으로 로그인할 수 있어요." };
}

export async function deletePasskey(id: string): Promise<ActionState> {
  const userId = await requireUserId();
  if (!z.uuid().safeParse(id).success) return { error: "잘못된 요청이에요." };
  try {
    await withUser(userId, (tx) => tx`delete from public.passkeys where id = ${id} and user_id = ${userId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/settings/account");
  return {};
}

const passwordChange = z
  .object({ current: z.string(), password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { message: "새 비밀번호가 서로 달라요." });

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = passwordChange.safeParse({
    current: formData.get("current") ?? "",
    password: formData.get("password") ?? "",
    passwordConfirm: formData.get("passwordConfirm") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await checkCurrentPassword(userId, parsed.data.current))) return { error: "지금 비밀번호가 맞지 않아요." };
  await setPassword(userId, parsed.data.password);
  return { savedAt: Date.now(), message: "비밀번호를 바꿨어요." };
}
