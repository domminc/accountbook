// 문자 자동 입력: 휴대폰 자동화가 보낸 카드 문자를 처리한다.
// 같은 가맹점에 지난번에 고른 소분류가 있으면 바로 거래로 저장하고(태그·지출방법도 지난번·카드 연결대로),
// 소분류를 모르거나 취소·중복 의심이면 "확인 필요"로 남겨 문자로 입력 화면에서 고르게 한다.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db, withUser } from "@/lib/db";
import { formatWon } from "@/lib/money";
import { todayKST } from "@/lib/month";
import { parseMessage, splitMessages } from "@/lib/sms";
import { txKindOf, type CategoryKind } from "@/lib/data/settings";
import { suggestForMessages } from "@/lib/data/paste";

export const INBOUND_MAX_CHARS = 10_000;
const MAX_MESSAGES = 20;

export function newInboundToken(): string {
  return `ab_${randomBytes(24).toString("base64url")}`;
}

export function inboundTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** 같은 문자인지 비교할 때 공백 차이는 무시한다 */
export function smsHash(raw: string): string {
  return createHash("sha256").update(raw.replace(/\s+/g, " ").trim(), "utf8").digest("hex");
}

export type InboundResult =
  | { ok: false; status: 401 | 400; message: string }
  | { ok: true; saved: string[]; pending: number; duplicates: number; ignored: number; message: string };

export async function processInbound(token: string, text: string, now = new Date()): Promise<InboundResult> {
  if (!token) return { ok: false, status: 401, message: "토큰이 없어요." };
  // 토큰으로 사람을 찾는다 (로그인 세션이 없으므로 여기만 db() 직접 사용)
  const [owner] = await db()<{ id: string; household_id: string; user_id: string }[]>`
    select t.id, t.household_id, t.user_id from public.inbound_tokens t
    join public.members m on m.household_id = t.household_id and m.user_id = t.user_id
    where t.token_hash = ${inboundTokenHash(token)}
  `;
  if (!owner) return { ok: false, status: 401, message: "토큰이 맞지 않아요. 설정 > 문자 자동 입력에서 다시 만들어 주세요." };

  const chunks = splitMessages(text).slice(0, MAX_MESSAGES);
  if (chunks.length === 0) return { ok: false, status: 400, message: "문자 내용이 비어 있어요." };
  const today = todayKST(now);

  return withUser(owner.user_id, async (tx) => {
    await tx`update public.inbound_tokens set last_used_at = now() where id = ${owner.id}`;
    const saved: string[] = [];
    let pending = 0;
    let duplicates = 0;
    let ignored = 0;

    for (const raw of chunks) {
      const text = raw.slice(0, 2000);
      const [msg] = await tx<{ id: string }[]>`
        insert into public.sms_messages (household_id, received_by, raw, raw_hash)
        values (${owner.household_id}, ${owner.user_id}, ${text}, ${smsHash(text)})
        on conflict (household_id, raw_hash) do nothing
        returning id
      `;
      if (!msg) {
        duplicates++;
        continue;
      }
      const parsed = parseMessage(text, today);
      if (!parsed) {
        // 거래 문자가 아님 (광고 등)
        await tx`update public.sms_messages set status = 'dismissed' where id = ${msg.id}`;
        ignored++;
        continue;
      }
      const [row] = await suggestForMessages(tx, owner.household_id, [parsed]);
      if (row.cancelled || row.amount === null || !row.categoryId || row.duplicateOf) {
        pending++;
        continue;
      }
      const [cat] = await tx<{ kind: CategoryKind }[]>`
        select g.kind from public.categories c join public.category_groups g on g.id = c.group_id
        where c.id = ${row.categoryId} and c.household_id = ${owner.household_id}
      `;
      if (!cat) {
        pending++;
        continue;
      }
      const id = randomUUID();
      await tx`
        insert into public.transactions (id, household_id, occurred_on, amount, category_id, payment_method_id, memo, created_by)
        values (${id}, ${owner.household_id}, ${row.date}, ${row.amount}, ${row.categoryId},
          ${txKindOf(cat.kind) === "expense" ? row.paymentMethodId : null}, ${row.merchant || null}, ${owner.user_id})
      `;
      for (const tagId of new Set(row.tagIds)) {
        await tx`insert into public.transaction_tags (transaction_id, tag_id, household_id) values (${id}, ${tagId}, ${owner.household_id})`;
      }
      await tx`update public.sms_messages set status = 'saved', transaction_id = ${id} where id = ${msg.id}`;
      saved.push(`${row.merchant || "가맹점 모름"} ${formatWon(row.amount)}원`);
    }

    const parts = [
      saved.length > 0 ? `가계부에 저장: ${saved.join(", ")}` : null,
      pending > 0 ? `확인 필요 ${pending}건 (가계부 > 거래 입력 > 카드 문자로 입력)` : null,
      duplicates > 0 ? `이미 받은 문자 ${duplicates}건` : null,
      ignored > 0 ? `거래 문자가 아님 ${ignored}건` : null,
    ].filter(Boolean);
    return { ok: true, saved, pending, duplicates, ignored, message: parts.join("\n") };
  });
}
