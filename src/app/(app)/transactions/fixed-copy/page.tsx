import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { addMonths, formatDateLabel, formatMonthLabel, monthRange, parseMonth, shiftDateToMonth } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { listTransactions } from "@/lib/data/transactions";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, primaryButtonClass } from "@/components/ui";
import { copyFixedExpenses } from "../actions";

export default async function FixedCopyPage({ searchParams }: PageProps<"/transactions/fixed-copy">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = parseMonth(Array.isArray(params.month) ? params.month[0] : params.month);
  const prevMonth = addMonths(month, -1);

  const { source, alreadyThisMonth } = await withUser(m.userId, async (tx) => {
    const [prev, current] = await Promise.all([
      listTransactions(tx, m.householdId, monthRange(prevMonth)),
      listTransactions(tx, m.householdId, monthRange(month)),
    ]);
    return {
      source: prev.filter((r) => r.groupKind === "fixed_expense").reverse(),
      alreadyThisMonth: current.filter((r) => r.groupKind === "fixed_expense").length,
    };
  });

  return (
    <div>
      <Link href={`/transactions?month=${month}`} className="text-sm text-muted">
        ← 내역
      </Link>
      <h1 className="mt-2 text-xl font-bold">지난달 고정지출 가져오기</h1>
      <p className="mt-1 text-sm text-muted">
        {formatMonthLabel(prevMonth)} 고정지출을 {formatMonthLabel(month)} 같은 날짜로 복사해요. 금액이 달라졌으면 가져온 뒤 고쳐 주세요.
      </p>
      {alreadyThisMonth > 0 ? (
        <p className="mt-3 rounded-lg border border-border px-3 py-2 text-sm">
          {formatMonthLabel(month)}에 이미 고정지출이 {alreadyThisMonth}건 있어요. 겹치지 않게 골라 주세요.
        </p>
      ) : null}

      {source.length === 0 ? (
        <p className="mt-10 text-center text-muted">{formatMonthLabel(prevMonth)}에 고정지출이 없어요.</p>
      ) : (
        <ActionForm action={copyFixedExpenses.bind(null, month)} className="mt-4 flex flex-col gap-4">
          <ul className={`divide-y divide-border ${cardClass}`}>
            {source.map((r) => (
              <li key={r.id}>
                <label className="flex items-center gap-3 px-4 py-3">
                  <input type="checkbox" name="ids" value={r.id} defaultChecked className="h-5 w-5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {r.categoryName}
                      {r.memo ? <span className="text-muted"> · {r.memo}</span> : null}
                    </span>
                    <span className="block text-sm text-muted">
                      {formatDateLabel(shiftDateToMonth(r.occurredOn, month))}
                      {r.paymentMethodName ? ` · ${r.paymentMethodName}` : ""}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatWon(r.amount)}</span>
                </label>
              </li>
            ))}
          </ul>
          <SubmitButton className={primaryButtonClass}>고른 항목 가져오기</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
