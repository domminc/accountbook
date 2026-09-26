import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayKST } from "@/lib/month";

export async function GET() {
  const m = await requireHousehold();
  const rows = await withUser(m.userId, (tx) => tx<
    { occurred_on: string; direction: "in" | "out"; category: string; amount: number; memo: string | null; note: string | null }[]
  >`
    select e.occurred_on, e.direction, c.name as category, e.amount, e.memo, e.note
    from public.reserve_entries e join public.reserve_categories c on c.id = e.reserve_category_id
    where e.household_id = ${m.householdId}
    order by e.occurred_on, e.created_at
  `);
  const body = toCsv(
    ["날짜", "구분", "분류", "금액", "내용", "비고"],
    rows.map((r) => [r.occurred_on, r.direction === "in" ? "입금" : "지출", r.category, r.amount, r.memo, r.note]),
  );
  return csvResponse(body, `가계부_예비비_${todayKST()}.csv`);
}
