"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db, pgErrorCode } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { firstError, loginIdSchema, passwordSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

const schema = z
  .object({ loginId: loginIdSchema, password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { message: "비밀번호가 서로 달라요." });

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    loginId: formData.get("loginId") ?? "",
    password: formData.get("password") ?? "",
    passwordConfirm: formData.get("passwordConfirm") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { loginId, password } = parsed.data;
  let userId: string;
  try {
    const [row] = await db()<{ id: string }[]>`
      insert into public.users (login_id, password_hash)
      values (${loginId}, ${await hashPassword(password)})
      returning id
    `;
    userId = row.id;
  } catch (e) {
    if (pgErrorCode(e) === "23505") return { error: "이미 쓰고 있는 아이디예요." };
    throw e;
  }

  await startSession(userId);
  redirect("/onboarding");
}
