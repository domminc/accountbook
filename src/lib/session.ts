import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ab_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

type Payload = { uid: string; exp: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET 환경 변수(32자 이상)가 필요합니다. .env.example 을 참고하세요.");
  }
  return s;
}

function sign(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** 사용자 id로 서명된 세션 토큰을 만든다. */
export function createSessionToken(userId: string, now = Date.now()): string {
  const payload: Payload = { uid: userId, exp: Math.floor(now / 1000) + SESSION_MAX_AGE };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

/** 토큰이 올바르고 만료되지 않았으면 사용자 id, 아니면 null. */
export function verifySessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Payload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < now) return null;
    return payload.uid;
  } catch {
    return null;
  }
}
