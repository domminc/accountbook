import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { formatWon } from "@/lib/money";
import { loadRecords } from "@/lib/data/finance";
import { RecordList } from "../record-list";

export default async function CardsPage() {
  const m = await requireHousehold();
  const cards = await withUser(m.userId, (tx) => loadRecords(tx, m.householdId, "cards"));
  const join = (parts: unknown[]) => parts.filter((p) => p !== null && p !== undefined && p !== "").join(" · ");

  return (
    <RecordList
      kind="cards"
      rows={cards}
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
        ]) || "정보 없음"
      }
    />
  );
}
