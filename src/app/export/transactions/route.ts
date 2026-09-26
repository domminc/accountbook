import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { listTransactions } from "@/lib/data/transactions";
import { TX_KIND_LABEL } from "@/lib/data/settings";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayKST } from "@/lib/month";

export async function GET() {
  const m = await requireHousehold();
  const rows = await withUser(m.userId, (tx) => listTransactions(tx, m.householdId, { start: "1900-01-01", end: "2999-12-31" }));
  const body = toCsv(
    ["날짜", "유형", "대분류", "소분류", "금액", "지출방법", "태그", "내용", "입력자"],
    [...rows].reverse().map((r) => [
      r.occurredOn,
      r.kind ? TX_KIND_LABEL[r.kind] : "분류 필요",
      r.groupName,
      r.categoryName,
      r.amount,
      r.paymentMethodName,
      r.tags.map((t) => t.name).join(" "),
      r.memo,
      r.creatorName,
    ]),
  );
  return csvResponse(body, `가계부_거래_${todayKST()}.csv`);
}
