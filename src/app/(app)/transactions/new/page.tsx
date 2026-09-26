import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { currentMonthKST, isValidMonth, todayKST } from "@/lib/month";
import { getTransaction, lastPaymentMethodId } from "@/lib/data/transactions";
import { uuidSchema } from "@/lib/validation";
import { saveTransaction } from "../actions";
import { TransactionForm, type FormInitial } from "../transaction-form";
import { loadFormOptions } from "../form-data";

export default async function NewTransactionPage({ searchParams }: PageProps<"/transactions/new">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = isValidMonth(params.month) ? params.month : currentMonthKST();
  const fromId = uuidSchema.safeParse(params.from).data;

  // 보고 있던 달이 이번 달이면 오늘, 아니면 그 달 1일
  const today = todayKST();
  const defaultDate = today.startsWith(month) ? today : `${month}-01`;

  const { options, initial } = await withUser(m.userId, async (tx) => {
    const source = fromId ? await getTransaction(tx, m.householdId, fromId) : null;
    const initial: FormInitial = source
      ? {
          // 복제: 날짜만 오늘로
          kind: source.kind ?? "expense",
          groupId: source.groupId,
          categoryId: source.categoryId,
          occurredOn: today,
          amount: source.amount,
          paymentMethodId: source.paymentMethodId,
          tagIds: source.tags.map((t) => t.id),
          memo: source.memo ?? "",
        }
      : {
          kind: "expense",
          groupId: null,
          categoryId: null,
          occurredOn: defaultDate,
          amount: null,
          paymentMethodId: await lastPaymentMethodId(tx, m.householdId, m.userId),
          tagIds: [],
          memo: "",
        };
    const options = await loadFormOptions(tx, m.householdId);
    return { options, initial };
  });

  return (
    <div>
      <Link href={`/transactions?month=${initial.occurredOn.slice(0, 7)}`} className="text-sm text-muted">
        ← 내역
      </Link>
      <h1 className="mt-2 mb-5 text-xl font-bold">{fromId ? "복제해서 입력" : "거래 입력"}</h1>
      <TransactionForm {...options} initial={initial} action={saveTransaction.bind(null, null)} allowSaveMore />
    </div>
  );
}
