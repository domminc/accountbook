import { INBOUND_MAX_CHARS, processInbound } from "@/lib/data/inbound";

/**
 * 문자 자동 입력. 휴대폰 자동화가 카드 문자를 보낸다.
 *   POST /api/sms
 *   Authorization: Bearer <설정 > 문자 자동 입력에서 만든 토큰>
 *   본문: JSON {"text": "..."} 또는 문자 내용 그대로 (text/plain)
 * 결과는 알림에 띄우기 좋은 한국어 문장 (Accept: application/json 이면 JSON).
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  const json = (req.headers.get("accept") ?? "").includes("application/json");

  const body = await req.text();
  if (body.length > INBOUND_MAX_CHARS) return reply(413, "문자가 너무 길어요.", json);
  let text = body;
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const v: unknown = JSON.parse(body);
      text = v && typeof v === "object" && "text" in v && typeof v.text === "string" ? v.text : "";
    } catch {
      return reply(400, "JSON 형식이 아니에요.", json);
    }
  }

  const r = await processInbound(token, text);
  if (!r.ok) return reply(r.status, r.message, json);
  return json
    ? Response.json({ saved: r.saved, pending: r.pending, duplicates: r.duplicates, ignored: r.ignored, message: r.message })
    : reply(200, r.message || "처리할 문자가 없어요.", false);
}

function reply(status: number, message: string, json: boolean) {
  return json
    ? Response.json({ message }, { status })
    : new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
