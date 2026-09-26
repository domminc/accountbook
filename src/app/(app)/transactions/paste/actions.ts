"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { isValidDate, todayKST } from "@/lib/month";
import { MAX_AMOUNT } from "@/lib/money";
import { parseMessage, parseMessages } from "@/lib/sms";
import type { PasteRow } from "@/lib/sms-suggest";
import { suggestForMessages } from "@/lib/data/paste";
import { firstError } from "@/lib/validation";
import { txKindOf, type CategoryKind } from "@/lib/data/settings";

const MAX_TEXT = 20_000;
const MAX_ROWS = 100;

/** 붙여넣은 문자를 읽어 거래 후보로. 지출방법·소분류는 카드 연결과 지난 입력으로 채운다. */
export async function analyzePaste(text: string): Promise<{ rows: PasteRow[] } | { error: string }> {
  if (typeof text !== "string" || !text.trim()) return { error: "문자를 붙여 넣어 주세요." };
  if (text.length > MAX_TEXT) return { error: "한 번에 2만 자까지 붙여 넣을 수 있어요." };
  const m = await requireHousehold();
  const messages = parseMessages(text, todayKST()).slice(0, MAX_ROWS);
  if (messages.length === 0) return { error: "금액이나 날짜가 있는 문자를 찾지 못했어요." };

  try {
    return { rows: await withUser(m.userId, (tx) => suggestForMessages(tx, m.householdId, messages)) };
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
}

const rowSchema = z.object({
  date: z.string().refine(isValidDate, "날짜를 확인해 주세요."),
  amount: z.number().int().min(1, "금액을 1원 ~ 1조 원 사이로 입력해 주세요.").max(MAX_AMOUNT, "금액을 1원 ~ 1조 원 사이로 입력해 주세요."),
  memo: z
    .string()
    .trim()
    .max(200, "내용은 200자 이하로 입력해 주세요.")
    .transform((v) => v || null),
  categoryId: z.uuid({ error: "소분류를 골라 주세요." }),
  paymentMethodId: z.uuid().nullable(),
  tagIds: z.array(z.uuid()).max(20).default([]),
  /** 자동으로 받은 문자에서 온 것이면 그 문자 id (저장하면 확인 끝) */
  messageId: z.uuid().nullable().default(null),
});
const rowsSchema = z.array(rowSchema).min(1, "저장할 거래를 골라 주세요.").max(MAX_ROWS);

export type PasteSaveRow = z.input<typeof rowSchema>;

/** 고른 후보를 한 번에 저장하고 내역으로 이동 */
export async function savePasted(rows: PasteSaveRow[]): Promise<{ error: string }> {
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const n = typeof issue?.path[0] === "number" ? `${issue.path[0] + 1}번째: ` : "";
    return { error: n + firstError(parsed.error) };
  }
  const list = parsed.data;
  const m = await requireHousehold();

  try {
    await withUser(m.userId, async (tx) => {
      const ids = [...new Set(list.map((r) => r.categoryId))];
      const cats = await tx<{ id: string; kind: CategoryKind }[]>`
        select c.id, g.kind from public.categories c
        join public.category_groups g on g.id = c.group_id
        where c.household_id = ${m.householdId} and c.id in ${tx(ids)}
      `;
      const kindOf = new Map(cats.map((c) => [c.id, txKindOf(c.kind)]));
      if (kindOf.size !== ids.length) throw new UserError("소분류를 다시 골라 주세요.");
      // id를 미리 정해 두고 넣는다 (태그·문자 연결에 쓴다)
      const inserted = list.map(() => ({ id: randomUUID() }));
      await tx`insert into public.transactions ${tx(
        list.map((r, i) => ({
          id: inserted[i].id,
          household_id: m.householdId,
          occurred_on: r.date,
          amount: r.amount,
          category_id: r.categoryId,
          // 결제 수단별 합계는 지출만 센다
          payment_method_id: kindOf.get(r.categoryId) === "expense" ? r.paymentMethodId : null,
          memo: r.memo,
          created_by: m.userId,
        })),
      )}`;
      const tags = list.flatMap((r, i) =>
        [...new Set(r.tagIds)].map((tagId) => ({ transaction_id: inserted[i].id, tag_id: tagId, household_id: m.householdId })),
      );
      if (tags.length > 0) await tx`insert into public.transaction_tags ${tx(tags)}`;
      for (const [i, r] of list.entries()) {
        if (!r.messageId) continue;
        await tx`
          update public.sms_messages set status = 'saved', transaction_id = ${inserted[i].id}
          where id = ${r.messageId} and household_id = ${m.householdId}
        `;
      }
    });
  } catch (e) {
    return { error: e instanceof UserError ? e.message : dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  const latest = list.map((r) => r.date).sort().at(-1)!;
  redirect(`/transactions?month=${latest.slice(0, 7)}`);
}

class UserError extends Error {}

export type InboxRow = PasteRow & { messageId: string };

/** 자동으로 받았지만 확인이 필요한 문자 (소분류를 모르거나, 취소·중복 의심) */
export async function loadPendingSms(): Promise<InboxRow[]> {
  const m = await requireHousehold();
  return withUser(m.userId, async (tx) => {
    const msgs = await tx<{ id: string; raw: string; received_at: Date }[]>`
      select id, raw, received_at from public.sms_messages
      where household_id = ${m.householdId} and status = 'pending' order by received_at limit ${MAX_ROWS}
    `;
    const parsed = msgs.map((x) => ({ id: x.id, p: parseMessage(x.raw, todayKST(x.received_at)) ?? null })).filter((x) => x.p);
    const rows = await suggestForMessages(tx, m.householdId, parsed.map((x) => x.p!));
    return rows.map((r, i) => ({ ...r, messageId: parsed[i].id }));
  });
}

/** 확인한 자동 입력 문자를 버린다 (저장하지 않음) */
export async function dismissSms(ids: string[]): Promise<{ error?: string }> {
  const parsed = z.array(z.uuid()).max(MAX_ROWS).safeParse(ids);
  if (!parsed.success) return { error: "입력값을 확인해 주세요." };
  const m = await requireHousehold();
  if (parsed.data.length === 0) return {};
  try {
    await withUser(m.userId, (tx) =>
      tx`update public.sms_messages set status = 'dismissed' where household_id = ${m.householdId} and id in ${tx(parsed.data)}`,
    );
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/transactions/paste");
  return {};
}
