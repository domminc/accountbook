import type { Tx } from "@/lib/db";
import type { ParsedMessage } from "@/lib/sms";
import { normalizeMemo, suggestRows, type PasteRow, type SuggestContext } from "@/lib/sms-suggest";

/** 문자에서 읽은 거래에 지출방법·소분류·태그 추천과 중복 표시를 붙인다 (붙여넣기·자동 입력 공용) */
export async function suggestForMessages(tx: Tx, householdId: string, messages: ParsedMessage[]): Promise<PasteRow[]> {
  if (messages.length === 0) return [];
  const keys = [...new Set(messages.map((x) => normalizeMemo(x.merchant)).filter(Boolean))];
  const dates = [...new Set(messages.map((x) => x.date))];
  const [cards, methods, history, existing] = await Promise.all([
    tx<{ name: string; issuer: string | null; payment_method_id: string | null }[]>`
      select name, issuer, payment_method_id from public.cards where household_id = ${householdId}
    `,
    tx<{ id: string; name: string }[]>`
      select id, name from public.payment_methods where household_id = ${householdId} and not is_hidden order by sort_order
    `,
    keys.length === 0
      ? Promise.resolve([])
      : tx<{ k: string; category_id: string | null; payment_method_id: string | null; tag_ids: string[] }[]>`
          select distinct on (k) k, category_id, payment_method_id,
            array(select tt.tag_id::text from public.transaction_tags tt where tt.transaction_id = t.id) as tag_ids
          from (
            select id, lower(regexp_replace(memo, '\\s+', '', 'g')) as k, category_id, payment_method_id, occurred_on, created_at
            from public.transactions
            where household_id = ${householdId} and memo is not null
          ) t
          where k in ${tx(keys)}
          order by k, occurred_on desc, created_at desc
        `,
    tx<{ occurred_on: string; amount: number; memo: string | null }[]>`
      select occurred_on, amount, memo from public.transactions
      where household_id = ${householdId} and occurred_on in ${tx(dates)}
    `,
  ]);
  const ctx: SuggestContext = {
    cards: cards.map((c) => ({ name: c.name, issuer: c.issuer, paymentMethodId: c.payment_method_id })),
    paymentMethods: methods,
    history: new Map(
      history.map((h) => [h.k, { categoryId: h.category_id, paymentMethodId: h.payment_method_id, tagIds: h.tag_ids }]),
    ),
    existing: existing.map((e) => ({ date: e.occurred_on, amount: e.amount, memo: e.memo })),
  };
  return suggestRows(messages, ctx);
}
