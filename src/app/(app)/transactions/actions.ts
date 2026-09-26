"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { isValidDate, isValidMonth, monthRange, addMonths, shiftDateToMonth } from "@/lib/month";
import { parseAmount } from "@/lib/money";
import { firstError, uuidSchema } from "@/lib/validation";
import { txKindOf, type CategoryKind, type TxKind } from "@/lib/data/settings";
import type { ActionState } from "@/lib/action-state";
import { insertReceipts, readReceiptFiles } from "@/lib/data/receipts";

/** "저장하고 계속 입력" 뒤 폼에 남길 값 */
export type KeptValues = {
  kind: TxKind;
  groupId: string;
  categoryId: string;
  occurredOn: string;
  paymentMethodId: string | null;
};
export type TransactionActionState = ActionState & { kept?: KeptValues };

const schema = z.object({
  occurredOn: z.string().refine(isValidDate, "날짜를 확인해 주세요."),
  amount: z
    .string()
    .transform(parseAmount)
    .refine((v): v is number => v !== null, "금액을 1원 ~ 1조 원 사이로 입력해 주세요."),
  categoryId: z.uuid({ error: "소분류를 골라 주세요." }),
  paymentMethodId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  tagIds: z.array(z.uuid()).max(20),
  memo: z
    .string()
    .trim()
    .max(200, "내용은 200자 이하로 입력해 주세요.")
    .transform((v) => v || null),
});

export async function saveTransaction(
  id: string | null,
  _prev: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const r = await persistTransaction(id, formData);
  if ("error" in r) return { error: r.error };

  revalidatePath("/", "layout");
  if (!id && formData.get("intent") === "more") {
    return { savedAt: Date.now(), message: "저장했어요. 이어서 입력하세요.", kept: r.kept };
  }
  redirect(`/transactions?month=${r.kept.occurredOn.slice(0, 7)}`);
}

/**
 * 오프라인일 때 기기에 모아 둔 새 거래를 올린다. 폼 값 그대로 받고, 이동하지 않는다.
 * clientId 로 저장하므로 같은 거래를 두 번 올려도 한 번만 들어간다.
 */
export async function syncOfflineTransaction(entries: [string, string][]): Promise<{ ok: true } | { error: string }> {
  if (!Array.isArray(entries) || entries.length > 50) return { error: "입력값을 확인해 주세요." };
  const formData = new FormData();
  for (const e of entries) {
    if (!Array.isArray(e) || typeof e[0] !== "string" || typeof e[1] !== "string") return { error: "입력값을 확인해 주세요." };
    formData.append(e[0], e[1]);
  }
  if (!formData.get("clientId")) return { error: "입력값을 확인해 주세요." };
  const r = await persistTransaction(null, formData);
  if ("error" in r) return r;
  revalidatePath("/", "layout");
  return { ok: true };
}

async function persistTransaction(id: string | null, formData: FormData): Promise<{ kept: KeptValues } | { error: string }> {
  const m = await requireHousehold();
  const clientId = String(formData.get("clientId") ?? "");
  if (clientId && !uuidSchema.safeParse(clientId).success) return { error: "입력값을 확인해 주세요." };
  const parsed = schema.safeParse({
    occurredOn: formData.get("occurredOn") ?? "",
    amount: formData.get("amount") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    paymentMethodId: formData.get("paymentMethodId") ?? "",
    tagIds: formData.getAll("tagIds"),
    memo: formData.get("memo") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  // 새 거래에 붙인 영수증 사진 (수정 화면에서는 따로 올린다)
  const receipts = id ? { files: [] } : await readReceiptFiles(formData);
  if ("error" in receipts) return { error: receipts.error };

  let kept: KeptValues;
  try {
    kept = await withUser(m.userId, async (tx) => {
      const [cat] = await tx<{ group_id: string; kind: CategoryKind }[]>`
        select c.group_id, g.kind from public.categories c
        join public.category_groups g on g.id = c.group_id
        where c.id = ${v.categoryId} and c.household_id = ${m.householdId}
      `;
      if (!cat) throw new UserError("소분류를 다시 골라 주세요.");
      const kind = txKindOf(cat.kind);
      // 결제 수단별 합계는 지출만 센다. 수입·저축에는 지출방법을 저장하지 않는다.
      const paymentMethodId = kind === "expense" ? v.paymentMethodId : null;

      let txId = id;
      if (txId) {
        const updated = await tx`
          update public.transactions
          set occurred_on = ${v.occurredOn}, amount = ${v.amount}, category_id = ${v.categoryId},
              payment_method_id = ${paymentMethodId}, memo = ${v.memo}
          where id = ${txId} and household_id = ${m.householdId}
        `;
        if (updated.count === 0) throw new UserError("거래를 찾을 수 없어요.");
        await tx`delete from public.transaction_tags where transaction_id = ${txId}`;
      } else if (clientId) {
        // 기기에서 만든 id로 저장: 응답을 못 받아 다시 올려도 두 번 들어가지 않는다
        const inserted = await tx`
          insert into public.transactions (id, household_id, occurred_on, amount, category_id, payment_method_id, memo, created_by)
          values (${clientId}, ${m.householdId}, ${v.occurredOn}, ${v.amount}, ${v.categoryId}, ${paymentMethodId}, ${v.memo}, ${m.userId})
          on conflict (id) do nothing
        `;
        if (inserted.count === 0) {
          const [dup] = await tx`select 1 from public.transactions where id = ${clientId} and household_id = ${m.householdId}`;
          if (!dup) throw new UserError("저장하지 못했어요. 다시 입력해 주세요.");
          return { kind, groupId: cat.group_id, categoryId: v.categoryId, occurredOn: v.occurredOn, paymentMethodId };
        }
        txId = clientId;
      } else {
        const [row] = await tx<{ id: string }[]>`
          insert into public.transactions (household_id, occurred_on, amount, category_id, payment_method_id, memo, created_by)
          values (${m.householdId}, ${v.occurredOn}, ${v.amount}, ${v.categoryId}, ${paymentMethodId}, ${v.memo}, ${m.userId})
          returning id
        `;
        txId = row.id;
      }

      if (!id) await insertReceipts(tx, m.householdId, m.userId, txId, receipts.files);

      for (const tagId of new Set(v.tagIds)) {
        await tx`
          insert into public.transaction_tags (transaction_id, tag_id, household_id)
          values (${txId}, ${tagId}, ${m.householdId})
        `;
      }
      return { kind, groupId: cat.group_id, categoryId: v.categoryId, occurredOn: v.occurredOn, paymentMethodId };
    });
  } catch (e) {
    return { error: e instanceof UserError ? e.message : dbErrorMessage(e) };
  }
  return { kept };
}

export async function deleteTransaction(id: string, month: string): Promise<ActionState> {
  const m = await requireHousehold();
  try {
    await withUser(m.userId, (tx) => tx`delete from public.transactions where id = ${id} and household_id = ${m.householdId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  redirect(isValidMonth(month) ? `/transactions?month=${month}` : "/transactions");
}

/** 지난달 고정지출 중 고른 것을 이번 달 같은 날짜로 복사 */
export async function copyFixedExpenses(month: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const m = await requireHousehold();
  if (!isValidMonth(month)) return { error: "월을 확인해 주세요." };
  const ids = z.array(z.uuid()).max(200).safeParse(formData.getAll("ids"));
  if (!ids.success || ids.data.length === 0) return { error: "가져올 고정지출을 골라 주세요." };

  const source = monthRange(addMonths(month, -1));
  try {
    await withUser(m.userId, async (tx) => {
      const rows = await tx<
        { id: string; occurred_on: string; amount: number; category_id: string; payment_method_id: string | null; memo: string | null }[]
      >`
        select t.id, t.occurred_on, t.amount, t.category_id, t.payment_method_id, t.memo
        from public.transactions t
        join public.categories c on c.id = t.category_id
        join public.category_groups g on g.id = c.group_id
        where t.household_id = ${m.householdId} and g.kind = 'fixed_expense'
          and t.occurred_on between ${source.start} and ${source.end}
          and t.id in ${tx(ids.data)}
      `;
      for (const r of rows) {
        const [copy] = await tx<{ id: string }[]>`
          insert into public.transactions (household_id, occurred_on, amount, category_id, payment_method_id, memo, created_by)
          values (${m.householdId}, ${shiftDateToMonth(r.occurred_on, month)}, ${r.amount}, ${r.category_id},
                  ${r.payment_method_id}, ${r.memo}, ${m.userId})
          returning id
        `;
        await tx`
          insert into public.transaction_tags (transaction_id, tag_id, household_id)
          select ${copy.id}, tag_id, household_id from public.transaction_tags where transaction_id = ${r.id}
        `;
      }
    });
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }

  revalidatePath("/", "layout");
  redirect(`/transactions?month=${month}`);
}

class UserError extends Error {}
