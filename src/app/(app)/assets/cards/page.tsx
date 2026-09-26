import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { monthRange, parseMonth } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { cardUsage } from "@/lib/summary";
import { loadCardInfos, loadRecords } from "@/lib/data/finance";
import { loadSimpleItems } from "@/lib/data/settings";
import { listTransactions } from "@/lib/data/transactions";
import { CardUsageList } from "@/components/card-usage";
import { MonthNav } from "@/components/month-nav";
import { cardClass } from "@/components/ui";
import { RecordList } from "../record-list";
import { paymentMethodOptions } from "../record-fields";

export default async function CardsPage({ searchParams }: PageProps<"/assets/cards">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = parseMonth(Array.isArray(params.month) ? params.month[0] : params.month);

  const data = await withUser(m.userId, async (tx) => {
    const [cards, infos, methods, rows] = await Promise.all([
      loadRecords(tx, m.householdId, "cards"),
      loadCardInfos(tx, m.householdId),
      loadSimpleItems(tx, m.householdId, "payment_methods"),
      listTransactions(tx, m.householdId, monthRange(month)),
    ]);
    return { cards, infos, methods, rows };
  });
  const usage = cardUsage(data.infos, data.rows);
  const methodName = new Map(data.methods.map((p) => [p.id, p.name]));
  const join = (parts: unknown[]) => parts.filter((p) => p !== null && p !== undefined && p !== "").join(" · ");

  return (
    <>
      <MonthNav month={month} basePath="/assets/cards" title="카드 관리" />

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">이번 달 카드 사용</h2>
        <p className="text-xs text-muted">카드에 연결한 지출방법으로 입력한 지출 (고정·비고정) 합계</p>
        {usage.length === 0 ? (
          <p className="mt-2 text-sm text-muted">카드를 펼쳐 &lsquo;연결할 지출방법&rsquo;을 고르면 이번 달 사용액을 예산과 비교해 보여줘요.</p>
        ) : (
          <div className="mt-3">
            <CardUsageList items={usage} />
          </div>
        )}
      </section>

      <RecordList
        kind="cards"
        rows={data.cards}
        paymentMethods={paymentMethodOptions(data.methods)}
        title={(c) => (
          <>
            {String(c.name)}
            {c.issuer ? <span className="ml-1.5 text-sm font-normal text-muted">{String(c.issuer)}</span> : null}
          </>
        )}
        summary={(c) =>
          join([
            c.card_type,
            c.purpose,
            c.billing_day ? `결제일 ${String(c.billing_day)}` : null,
            c.monthly_budget ? `예산 ${formatWon(Number(c.monthly_budget))}` : null,
            c.credit_limit ? `한도 ${formatWon(Number(c.credit_limit))}` : null,
            c.payment_method_id ? `지출방법 ${methodName.get(String(c.payment_method_id)) ?? ""}` : null,
          ]) || "정보 없음"
        }
      />
    </>
  );
}
