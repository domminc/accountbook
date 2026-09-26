// DB 주소·세션 비밀값 고르기. 앱(src/lib/db.ts, session.ts)과 배포 스크립트(scripts/migrate.mjs)가 같이 쓴다.
//
// 1. DATABASE_URL 이 제대로 있으면 그것
// 2. DATABASE_URL 비밀번호 자리에 [YOUR-PASSWORD] 가 남아 있고, Vercel 의 Supabase 연동이 넣어 준
//    POSTGRES_PASSWORD 가 같은 프로젝트 것이면 그 비밀번호로 채움
// 3. 연동이 넣어 준 POSTGRES_URL (비밀번호가 채워진 풀러 주소)
import { createHmac } from "node:crypto";

const PLACEHOLDER = /\[?YOUR[-_]PASSWORD\]?/i;

/** 주소 속 Supabase 프로젝트 ref (postgres.<ref> 사용자 이름 또는 db.<ref>.supabase.co 호스트) */
export function projectRef(url) {
  try {
    const u = new URL(url);
    return (
      /^postgres\.([a-z0-9]{10,})$/i.exec(decodeURIComponent(u.username))?.[1] ??
      /^db\.([a-z0-9]{10,})\.supabase\.co$/i.exec(u.hostname)?.[1] ??
      null
    );
  } catch {
    return null;
  }
}

function usable(url) {
  try {
    const u = new URL(url);
    return Boolean(u.hostname && u.password) && !PLACEHOLDER.test(url);
  } catch {
    return false;
  }
}

/** postgres.js 가 모르는 쿼리(supa=… 등)는 빼고 sslmode 만 남긴다 */
function clean(url) {
  const u = new URL(url);
  for (const k of [...u.searchParams.keys()]) if (k !== "sslmode") u.searchParams.delete(k);
  return u.toString();
}

/** @returns {{ url: string | null, source: string }} */
export function resolveDatabaseUrl(env = process.env) {
  const direct = (env.DATABASE_URL ?? "").trim();
  if (direct && usable(direct)) return { url: direct, source: "DATABASE_URL" };

  const integration = (env.POSTGRES_URL ?? "").trim();
  const password = env.POSTGRES_PASSWORD ?? "";
  if (direct && PLACEHOLDER.test(direct) && password) {
    const ref = projectRef(direct);
    const sameProject = ref && [integration, env.POSTGRES_HOST, env.POSTGRES_USER, env.SUPABASE_URL].some((v) => v && v.includes(ref));
    if (sameProject) {
      return { url: direct.replace(PLACEHOLDER, encodeURIComponent(password)), source: "DATABASE_URL + POSTGRES_PASSWORD(연동)" };
    }
  }
  if (integration && usable(integration)) return { url: clean(integration), source: "POSTGRES_URL(연동)" };
  return { url: direct || null, source: direct ? "DATABASE_URL (사용할 수 없음)" : "없음" };
}

/** 세션 쿠키 서명 비밀값: SESSION_SECRET, 없으면 이미 있는 비밀값에서 만든다 */
export function resolveSessionSecret(env = process.env) {
  const s = env.SESSION_SECRET ?? "";
  if (s.length >= 32) return { secret: s, source: "SESSION_SECRET" };
  const base = env.SUPABASE_JWT_SECRET || env.POSTGRES_PASSWORD || passwordOf(resolveDatabaseUrl(env).url);
  if (!base) return { secret: null, source: s ? "SESSION_SECRET 너무 짧음" : "없음" };
  return {
    secret: createHmac("sha256", base).update("accountbook-session-v1").digest("hex"),
    source: env.SUPABASE_JWT_SECRET ? "SUPABASE_JWT_SECRET(연동)에서 만듦" : env.POSTGRES_PASSWORD ? "POSTGRES_PASSWORD(연동)에서 만듦" : "DB 비밀번호에서 만듦",
  };
}

function passwordOf(url) {
  if (!url || !usable(url)) return "";
  try {
    return decodeURIComponent(new URL(url).password);
  } catch {
    return "";
  }
}
