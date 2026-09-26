import Link from "next/link";
import { notFound } from "next/navigation";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { getTransaction } from "@/lib/data/transactions";
import { uuidSchema } from "@/lib/validation";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { secondaryButtonClass } from "@/components/ui";
import { deleteTransaction, saveTransaction } from "../actions";
import { TransactionForm } from "../transaction-form";
import { loadFormOptions } from "../form-data";

export default async function EditTransactionPage({ params }: PageProps<"/transactions/[id]">) {
  const m = await requireHousehold();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const data = await withUser(m.userId, async (tx) => {
    const t = await getTransaction(tx, m.householdId, id);
    if (!t) return null;
    const options = await loadFormOptions(tx, m.householdId, {
      categoryId: t.categoryId,
      paymentMethodId: t.paymentMethodId,
      tagIds: t.tags.map((x) => x.id),
    });
    return { t, options };
  });
  if (!data) notFound();
  const { t, options } = data;
  const month = t.occurredOn.slice(0, 7);

  return (
    <div>
      <Link href={`/transactions?month=${month}`} className="text-sm text-muted">
        ← 내역
      </Link>
      <h1 className="mt-2 text-xl font-bold">거래 수정</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        {t.creatorName ? `${t.creatorName}님이 입력` : null}
        {t.kind === null ? " · 분류가 필요한 거래예요" : null}
      </p>

      <TransactionForm
        {...options}
        initial={{
          kind: t.kind ?? "expense",
          groupId: t.groupId,
          categoryId: t.categoryId,
          occurredOn: t.occurredOn,
          amount: t.amount,
          paymentMethodId: t.paymentMethodId,
          tagIds: t.tags.map((x) => x.id),
          memo: t.memo ?? "",
        }}
        action={saveTransaction.bind(null, t.id)}
        allowSaveMore={false}
      />

      <div className="mt-6 flex gap-2 border-t border-border pt-6">
        <Link href={`/transactions/new?from=${t.id}`} className={`flex flex-1 items-center justify-center ${secondaryButtonClass}`}>
          복제해서 새로 입력
        </Link>
        <ActionForm action={deleteTransaction.bind(null, t.id, month)} className="flex-1">
          <SubmitButton className={`w-full text-danger ${secondaryButtonClass}`} confirmMessage="이 거래를 지울까요?">
            삭제
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
