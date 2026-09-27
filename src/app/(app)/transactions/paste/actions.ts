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
import { isLedgerSheet, parseStatement } from "@/lib/statement";
import type { PasteRow } from "@/lib/sms-suggest";
import { suggestForMessages } from "@/lib/data/paste";
import { firstError } from "@/lib/validation";
import { txKindOf, type CategoryKind } from "@/lib/data/settings";

const MAX_TEXT = 20_000;
const MAX_ROWS = 100;
/** 카드 명세서 파일은 한 달치가 100건을 넘기도 한다 */
const MAX_FILE_ROWS = 500;

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

const statementSchema = z
  .object({
    rows: z.array(z.array(z.string().max(1000)).max(60)).max(5000).optional(),
    lines: z.array(z.string().max(2000)).max(5000).optional(),
    fileName: z.string().max(300).optional(),
  })
  .refine((v) => (v.rows?.length ?? 0) + (v.lines?.length ?? 0) > 0, "파일에서 글자를 찾지 못했어요.");

export type StatementResult = { rows: PasteRow[]; found: number; cancelledPairs: number } | { error: string };

/** 카드 이용내역·명세서 파일(브라우저에서 글자로 바꾼 것)을 읽어 거래 후보로 */
export async function analyzeStatement(input: z.input<typeof statementSchema>): Promise<StatementResult> {
  const parsed = statementSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (isLedgerSheet(parsed.data)) {
    return { error: "가계부 시트 파일이에요. 시트는 설정 → 데이터 가져오기·내보내기에서 올려 주세요. (여기서는 카드사 이용내역·명세서만 읽어요)" };
  }
  const m = await requireHousehold();
  const { messages, cancelledPairs } = parseStatement(parsed.data, todayKST());
  if (messages.length === 0) {
    return {
      error:
        cancelledPairs > 0
          ? "파일의 거래가 모두 취소된 거래예요."
          : "파일에서 거래(날짜·금액)를 찾지 못했어요. 카드사 홈페이지·앱의 이용내역을 엑셀(xls·xlsx)이나 csv로 받아 올려 주세요.",
    };
  }
  try {
    const rows = await withUser(m.userId, (tx) => suggestForMessages(tx, m.householdId, messages.slice(0, MAX_FILE_ROWS)));
    return { rows, found: messages.length, cancelledPairs };
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
const rowsSchema = z.array(rowSchema).min(1, "저장할 거래를 골라 주세요.").max(MAX_FILE_ROWS, `한 번에 ${MAX_FILE_ROWS}건까지 저장할 수 있어요.`);

export type PasteSaveRow = z.input<typeof rowSchema>;

/** 고른 후보를 한 번에 저장하고 내역으로 이동. 한 번에 저장한 것은 묶음으로 남겨 되돌릴 수 있게 한다 */
export async function savePasted(rows: PasteSaveRow[], meta: { fileName?: string | null } = {}): Promise<{ error: string }> {
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
      const fileName = typeof meta.fileName === "string" && meta.fileName.trim() ? meta.fileName.trim().slice(0, 300) : null;
      const [batch] = await tx<{ id: string }[]>`
        insert into public.entry_batches (household_id, source, file_name, created_by)
        values (${m.householdId}, ${fileName ? "file" : "text"}, ${fileName}, ${m.userId})
        returning id
      `;
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
          entry_batch_id: batch.id,
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

export type EntryBatch = {
  id: string;
  source: "file" | "text" | "earlier";
  fileName: string | null;
  createdAt: string;
  createdBy: string | null;
  count: number;
  total: number;
  from: string;
  to: string;
};

/** 최근에 한꺼번에 저장한 묶음 (거래가 남아 있는 것만) */
export async function loadEntryBatches(): Promise<EntryBatch[]> {
  const m = await requireHousehold();
  return withUser(m.userId, async (tx) => {
    const rows = await tx<
      { id: string; source: EntryBatch["source"]; file_name: string | null; created_at: Date; created_by: string | null; count: number; total: number; from: string; to: string }[]
    >`
      select b.id, b.source, b.file_name, b.created_at, mem.display_name as created_by,
        count(t.id)::int as count, sum(t.amount)::bigint as total, min(t.occurred_on) as from, max(t.occurred_on) as to
      from public.entry_batches b
      join public.transactions t on t.entry_batch_id = b.id
      left join public.members mem on mem.household_id = b.household_id and mem.user_id = b.created_by
      where b.household_id = ${m.householdId}
      group by b.id, mem.display_name
      order by b.created_at desc
      limit 10
    `;
    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      fileName: r.file_name,
      createdAt: r.created_at.toISOString(),
      createdBy: r.created_by,
      count: r.count,
      total: Number(r.total),
      from: r.from,
      to: r.to,
    }));
  });
}

/** 한꺼번에 저장한 묶음을 되돌린다: 그때 넣은 거래를 모두 지우고, 자동으로 받은 문자는 다시 "확인 필요"로 */
export async function undoEntryBatch(id: string): Promise<{ error?: string; removed?: number }> {
  if (!z.uuid().safeParse(id).success) return { error: "입력값을 확인해 주세요." };
  const m = await requireHousehold();
  try {
    const removed = await withUser(m.userId, async (tx) => {
      await tx`
        update public.sms_messages set status = 'pending', transaction_id = null
        where household_id = ${m.householdId}
          and transaction_id in (select t.id from public.transactions t where t.household_id = ${m.householdId} and t.entry_batch_id = ${id})
      `;
      const [{ n }] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.transactions where household_id = ${m.householdId} and entry_batch_id = ${id}
      `;
      const del = await tx`delete from public.entry_batches where household_id = ${m.householdId} and id = ${id}`;
      if (del.count === 0) throw new UserError("이미 되돌렸거나 없는 묶음이에요.");
      return n;
    });
    revalidatePath("/", "layout");
    return { removed };
  } catch (e) {
    return { error: e instanceof UserError ? e.message : dbErrorMessage(e) };
  }
}
