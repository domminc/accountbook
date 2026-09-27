import type { Tx } from "@/lib/db";

// 중복 의심 거래: 같은 달·같은 소분류·같은 금액·같은 내용(띄어쓰기 무시)이 두 건 이상.
// 어디서 들어왔는지(시트 가져오기·파일·문자·결제일·직접 입력)와 넣은 때를 같이 보여 주어 무엇을 지울지 고르게 한다.

export type DuplicateRow = {
  id: string;
  occurredOn: string;
  amount: number;
  memo: string | null;
  categoryName: string | null;
  groupName: string | null;
  fixed: boolean;
  /** 어디서 들어왔는지 */
  source: string;
  createdAt: string;
  createdBy: string | null;
};

export type DuplicateGroup = { key: string; month: string; rows: DuplicateRow[] };

type Raw = {
  id: string;
  occurred_on: string;
  amount: number;
  memo: string | null;
  k: string;
  category_id: string | null;
  category_name: string | null;
  group_name: string | null;
  group_kind: string | null;
  import_file: string | null;
  import_year: number | null;
  entry_source: "file" | "text" | "earlier" | null;
  entry_file: string | null;
  recurring: boolean;
  created_at: Date;
  created_by: string | null;
};

function sourceLabel(r: Raw): string {
  if (r.import_file !== null) return `시트 가져오기 (${r.import_year}년 · ${r.import_file})`;
  if (r.entry_source === "file") return `카드 파일 (${r.entry_file ?? "파일"})`;
  if (r.entry_source === "text") return "카드 문자 붙여넣기";
  if (r.entry_source === "earlier") return "한꺼번에 저장";
  if (r.recurring) return "결제일 관리에서 입력";
  return "직접 입력";
}

export async function findDuplicateGroups(tx: Tx, householdId: string): Promise<DuplicateGroup[]> {
  const rows = await tx<Raw[]>`
    with t as (
      select t.id, t.occurred_on, t.amount, t.memo, t.category_id, t.created_at,
        lower(regexp_replace(coalesce(t.memo, ''), '\\s+', '', 'g')) as k,
        c.name as category_name, g.name as group_name, g.kind::text as group_kind,
        ib.file_name as import_file, ib.year as import_year,
        eb.source as entry_source, eb.file_name as entry_file,
        t.recurring_payment_id is not null as recurring,
        mem.display_name as created_by
      from public.transactions t
      left join public.categories c on c.id = t.category_id
      left join public.category_groups g on g.id = c.group_id
      left join public.import_batches ib on ib.id = t.import_batch_id
      left join public.entry_batches eb on eb.id = t.entry_batch_id
      left join public.members mem on mem.household_id = t.household_id and mem.user_id = t.created_by
      where t.household_id = ${householdId}
    )
    select * from (
      select t.*, count(*) over (partition by date_trunc('month', occurred_on), category_id, amount, k) as n
      from t
    ) d
    where n > 1
    order by occurred_on, created_at
    limit 2000
  `;
  const groups = new Map<string, DuplicateGroup>();
  for (const r of rows) {
    const month = r.occurred_on.slice(0, 7);
    const key = `${month}|${r.category_id ?? ""}|${r.amount}|${r.k}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, month, rows: [] }));
    g.rows.push({
      id: r.id,
      occurredOn: r.occurred_on,
      amount: Number(r.amount),
      memo: r.memo,
      categoryName: r.category_name,
      groupName: r.group_name,
      fixed: r.group_kind === "fixed_expense",
      source: sourceLabel(r),
      createdAt: r.created_at.toISOString(),
      createdBy: r.created_by,
    });
  }
  for (const g of groups.values()) g.rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.occurredOn.localeCompare(b.occurredOn));
  // 고정지출 먼저, 그다음 날짜순
  return [...groups.values()].sort((a, b) => Number(b.rows[0].fixed) - Number(a.rows[0].fixed) || a.key.localeCompare(b.key));
}
