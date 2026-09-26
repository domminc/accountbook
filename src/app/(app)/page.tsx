import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { currentMonthKST, formatDateLabel, formatMonthLabel, monthRange } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { listTransactions, sumByKind } from "@/lib/data/transactions";
import { cardClass, primaryButtonClass } from "@/components/ui";

export default async function HomePage() {
  const m = await requireHousehold();
  const month = currentMonthKST();
  const rows = await withUser(m.userId, (tx) => listTransactions(tx, m.householdId, monthRange(month)));
  const totals = sumByKind(rows);

  return (
    <div>
      <p className="text-sm text-muted">{m.householdName}</p>
      <h1 className="text-xl font-bold">{formatMonthLabel(month)}</h1>

      <dl className={`mt-4 grid grid-cols-2 gap-y-4 p-5 ${cardClass}`}>
        <Stat label="총 수입" value={totals.income} />
        <Stat label="총 지출" value={totals.expense} />
        <Stat label="총 저축" value={totals.saving} />
        <Stat label="남은 금액" value={totals.income - totals.expense} signed />
      </dl>
      <p className="mt-2 text-xs text-muted">예산·목표·무지출 달력이 있는 이달의 정리는 다음 단계에서 열려요.</p>

      <Link href="/transactions/new" className={`mt-5 flex items-center justify-center ${primaryButtonClass}`}>
        거래 입력
      </Link>

      <section className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">최근 거래</h2>
          <Link href="/transactions" className="text-sm text-muted">
            전체 보기
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">이번 달 거래가 아직 없어요.</p>
        ) : (
          <ul className={`mt-2 divide-y divide-border ${cardClass}`}>
            {rows.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link href={`/transactions/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate">{r.categoryName ?? "분류 필요"}{r.memo ? ` · ${r.memo}` : ""}</span>
                    <span className="block text-xs text-muted">{formatDateLabel(r.occurredOn)}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatWon(r.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${signed && value < 0 ? "text-danger" : ""}`}>
        {formatWon(value)}원
      </dd>
    </div>
  );
}
