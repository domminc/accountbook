import type { Tx } from "@/lib/db";
import { monthRange } from "@/lib/month";
import type { ParsedMessage } from "@/lib/sms";
import { NEAR_DAYS, normalizeMemo, suggestRows, type PasteRow, type SuggestContext } from "@/lib/sms-suggest";

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 문자에서 읽은 거래에 지출방법·소분류·태그 추천과 중복 표시를 붙인다 (붙여넣기·자동 입력 공용) */
export async function suggestForMessages(tx: Tx, householdId: string, messages: ParsedMessage[]): Promise<PasteRow[]> {
  if (messages.length === 0) return [];
  const keys = [...new Set(messages.map((x) => normalizeMemo(x.merchant)).filter(Boolean))];
  const dates = messages.map((x) => x.date).sort();
  // 중복을 찾을 기간: 3일 앞뒤와 같은 달 전체
  const [minDate, maxDate] = [dates[0], dates[dates.length - 1]];
  const from = [addDays(minDate, -NEAR_DAYS), monthRange(minDate.slice(0, 7)).start].sort()[0];
  const to = [addDays(maxDate, NEAR_DAYS), monthRange(maxDate.slice(0, 7)).end].sort()[1];
  const amounts = [...new Set(messages.map((x) => x.amount).filter((a): a is number => a !== null))];
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
    // 3일 앞뒤와 같은 달 전체에서 같은 금액 (중복 의심)
    amounts.length === 0
      ? Promise.resolve([])
      : tx<{ occurred_on: string; amount: number; memo: string | null; fixed: boolean }[]>`
          select t.occurred_on, t.amount, t.memo, coalesce(g.kind = 'fixed_expense', false) as fixed
          from public.transactions t
          left join public.categories c on c.id = t.category_id
          left join public.category_groups g on g.id = c.group_id
          where t.household_id = ${householdId}
            and t.amount in ${tx(amounts)}
            and t.occurred_on between ${from} and ${to}
        `,
  ]);
  const ctx: SuggestContext = {
    cards: cards.map((c) => ({ name: c.name, issuer: c.issuer, paymentMethodId: c.payment_method_id })),
    paymentMethods: methods,
    history: new Map(
      history.map((h) => [h.k, { categoryId: h.category_id, paymentMethodId: h.payment_method_id, tagIds: h.tag_ids }]),
    ),
    existing: existing.map((e) => ({ date: e.occurred_on, amount: Number(e.amount), memo: e.memo, fixed: e.fixed })),
  };
  return suggestRows(messages, ctx);
}
