import postgres from "postgres";
import { projectRef, resolveDatabaseUrl, resolveSessionSecret } from "@/lib/db-url.mjs";

/**
 * 배포 점검용. 로그인 없이 열 수 있고, 비밀 값은 보여주지 않는다.
 * 환경 변수가 있는지(길이만), DB 에 접속되는지, 표가 만들어졌는지를 한국어로 알려준다.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { url, source } = resolveDatabaseUrl();
  const session = resolveSessionSecret();
  const rawUrl = process.env.DATABASE_URL ?? "";
  // 이름에 공백·오타가 섞인 변수, Vercel Supabase 연동이 넣은 변수 (이름만)
  const similar = Object.keys(process.env).filter(
    (k) => /DATABASE|SESSION/i.test(k) && k !== "DATABASE_URL" && k !== "SESSION_SECRET",
  );
  const integration = Object.keys(process.env).filter((k) => /^(POSTGRES|SUPABASE)_/.test(k));

  const report: Record<string, unknown> = {
    DATABASE_URL: rawUrl ? `있음 (${rawUrl.length}자) ${describeUrl(rawUrl)}` : "없음",
    SESSION_SECRET: session.secret ? `사용 가능 — ${session.source}` : `없음 — ${session.source}`,
    쓰는_DB_주소: url ? `${source}: ${describeUrl(url)}` : "없음",
    연동_변수: integration,
    비슷한_이름의_변수: similar.map((k) => JSON.stringify(k)),
    지역: process.env.VERCEL_REGION ?? "알 수 없음",
  };

  if (url) {
    const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10, idle_timeout: 1 });
    try {
      const [r] = await sql<{ households: string | null; inbound: string | null }[]>`
        select to_regclass('public.households')::text as households, to_regclass('public.inbound_tokens')::text as inbound
      `;
      report["DB"] = "접속됨";
      report["표"] = r.households && r.inbound ? "모두 있음" : r.households ? "일부만 있음 (최신 SQL 이 빠짐)" : "없음 (SQL 을 실행하지 않음)";
    } catch (e) {
      report["DB"] = `접속 실패: ${redact(e instanceof Error ? e.message : String(e))}`;
    } finally {
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  }

  const ok = report["DB"] === "접속됨" && report["표"] === "모두 있음" && Boolean(session.secret);
  return Response.json({ 상태: ok ? "정상" : "문제 있음", ...report }, { status: ok ? 200 : 500, headers: { "cache-control": "no-store" } });
}

/** 비밀번호를 뺀 주소 모양 */
function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    const pass = u.password;
    const passNote = !pass ? "비밀번호 없음" : pass.includes("YOUR-PASSWORD") || pass.startsWith("[") ? "비밀번호 자리에 [YOUR-PASSWORD] 가 그대로 있음" : `비밀번호 ${decodeURIComponent(pass).length}자`;
    return `${u.protocol}//${u.username}:****@${u.hostname}:${u.port || "5432"}${u.pathname} (${passNote}, 프로젝트 ${projectRef(url) ?? "?"})`;
  } catch {
    return "주소 형식이 잘못됨 (postgres:// 로 시작하는지, 비밀번호에 특수문자가 있는지 확인)";
  }
}

function redact(s: string) {
  return s.replace(/\/\/[^@\s]*@/g, "//****@");
}
