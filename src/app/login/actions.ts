"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { verifyPassword, verifyPasswordDummy } from "@/lib/password";
import { passkeyLoginOptions, verifyPasskeyLogin } from "@/lib/passkey";
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { safeNextPath } from "@/lib/safe-next-path";
import type { ActionState } from "@/lib/action-state";

const LOGIN_FAILED = "아이디 또는 비밀번호가 맞지 않아요.";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const loginId = String(formData.get("loginId") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!loginId || !password) return { error: "아이디와 비밀번호를 입력해 주세요." };

  const [user] = await db()<{ id: string; password_hash: string }[]>`
    select id, password_hash from public.users where login_id = ${loginId}
  `;
  const ok = user ? await verifyPassword(password, user.password_hash) : await verifyPasswordDummy(password);
  if (!user || !ok) return { error: LOGIN_FAILED };

  await startSession(user.id);
  redirect(next);
}

/** Face ID·지문 로그인 1단계: 기기에 보낼 challenge */
export async function startPasskeyLogin(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return passkeyLoginOptions();
}

export type PasskeyLoginState = { next?: string; error?: string; unknownCredential?: { rpID: string; credentialID: string } };

/** Face ID·지문 로그인 2단계: 기기의 서명을 확인하고 로그인. 화면 이동은 브라우저가 한다. */
export async function finishPasskeyLogin(response: AuthenticationResponseJSON, next: string): Promise<PasskeyLoginState> {
  const result = await verifyPasskeyLogin(response);
  if ("error" in result) return result;
  await startSession(result.userId);
  return { next: safeNextPath(next) };
}
