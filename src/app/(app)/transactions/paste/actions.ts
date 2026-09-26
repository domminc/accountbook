"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { isValidDate, todayKST } from "@/lib/month";
import { MAX_AMOUNT } from "@/lib/money";
import { parseMessages } from "@/lib/sms";
import { normalizeMemo, suggestRows, type PasteRow } from "@/lib/sms-suggest";
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

  const keys = [...new Set(messages.map((x) => normalizeMemo(x.merchant)).filter(Boolean))];
  const dates = [...new Set(messages.map((x) => x.date))];
  try {
    const ctx = await withUser(m.userId, async (tx) => {
      const [cards, methods, history, existing] = await Promise.all([
        tx<{ name: string; issuer: string | null; payment_method_id: string | null }[]>`
          select name, issuer, payment_method_id from public.cards where household_id = ${m.householdId}
        `,
        tx<{ id: string; name: string }[]>`
          select id, name from public.payment_methods where household_id = ${m.householdId} and not is_hidden order by sort_order
        `,
        keys.length === 0
          ? Promise.resolve([])
          : tx<{ k: string; category_id: string | null; payment_method_id: string | null }[]>`
              select distinct on (k) k, category_id, payment_method_id from (
                select lower(regexp_replace(memo, '\\s+', '', 'g')) as k, category_id, payment_method_id, occurred_on, created_at
                from public.transactions
                where household_id = ${m.householdId} and memo is not null
              ) t
              where k in ${tx(keys)}
              order by k, occurred_on desc, created_at desc
            `,
        tx<{ occurred_on: string; amount: number; memo: string | null }[]>`
          select occurred_on, amount, memo from public.transactions
          where household_id = ${m.householdId} and occurred_on in ${tx(dates)}
        `,
      ]);
      return {
        cards: cards.map((c) => ({ name: c.name, issuer: c.issuer, paymentMethodId: c.payment_method_id })),
        paymentMethods: methods,
        history: new Map(history.map((h) => [h.k, { categoryId: h.category_id, paymentMethodId: h.payment_method_id }])),
        existing: existing.map((e) => ({ date: e.occurred_on, amount: e.amount, memo: e.memo })),
      };
    });
    return { rows: suggestRows(messages, ctx) };
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
      await tx`insert into public.transactions ${tx(
        list.map((r) => ({
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
    });
  } catch (e) {
    return { error: e instanceof UserError ? e.message : dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  const latest = list.map((r) => r.date).sort().at(-1)!;
  redirect(`/transactions?month=${latest.slice(0, 7)}`);
}

class UserError extends Error {}
