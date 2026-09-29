import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";

// 비밀번호 해시는 로그인 사용자 역할(authenticated)로 읽거나 고칠 수 없게 막아 두었다 (users 표 권한).
// 그래서 로그인처럼 서버 권한(db())으로 다루되, 항상 세션의 사용자 id 한 명으로만 조건을 건다.

/**
 * 탈퇴·비밀번호 변경 전에 지금 비밀번호를 확인한다.
 * 비밀번호 없이 만든 계정(구글·카카오 연결용, 지금은 없음)은 확인할 비밀번호가 없어 통과한다.
 */
export async function checkCurrentPassword(userId: string, password: string): Promise<boolean> {
  const [user] = await db()<{ password_hash: string | null }[]>`
    select password_hash from public.users where id = ${userId}
  `;
  if (!user) return false;
  if (!user.password_hash) return true;
  return verifyPassword(password, user.password_hash);
}

export async function setPassword(userId: string, password: string): Promise<void> {
  await db()`update public.users set password_hash = ${await hashPassword(password)} where id = ${userId}`;
}
