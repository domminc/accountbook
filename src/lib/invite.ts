import { createHash, randomBytes } from "node:crypto";

export const INVITE_DAYS = 7;

/** 초대 링크 토큰 (DB에는 해시만 저장) */
export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/** DB의 public.invite_token_hash() 와 같은 계산 */
export function inviteTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
