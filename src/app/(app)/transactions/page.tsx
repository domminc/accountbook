import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { formatDateLabel, monthRange, parseMonth, todayKST } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { uuidSchema } from "@/lib/validation";
import { loadCategoryGroups, loadMembers, loadSimpleItems } from "@/lib/data/settings";
import { groupByDate, lastPaymentMethodId, listTransactions, sumByKind, type TransactionFilters, type TransactionRow } from "@/lib/data/transactions";
import { cardClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { MonthNav } from "@/components/month-nav";
import { ViewTabs } from "./view-tabs";
import { QuickAdd } from "./quick-add";
import { saveTransaction } from "./actions";
import { loadFormOptions } from "./form-data";

type Search = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const uuidOrUndefined = (v: string | string[] | undefined) => uuidSchema.safeParse(one(v)).data;

function parseFilters(p: Search): TransactionFilters {
  const q = one(p.q)?.trim().slice(0, 50);
  return {
    groupId: uuidOrUndefined(p.group),
    categoryId: uuidOrUndefined(p.cat),
    paymentMethodId: uuidOrUndefined(p.pm),
    tagId: uuidOrUndefined(p.tag),
    createdBy: uuidOrUndefined(p.member),
    query: q || undefined,
    uncategorized: one(p.uncategorized) === "1",
  };
}

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = parseMonth(one(params.month));
  const filters = parseFilters(params);
  const filtered = Object.values(filters).some(Boolean);

  const { rows, groups, methods, tags, members, options, lastMethod } = await withUser(m.userId, async (tx) => {
    const [rows, groups, methods, tags, members, options, lastMethod] = await Promise.all([
      listTransactions(tx, m.householdId, monthRange(month), filters),
      loadCategoryGroups(tx, m.householdId),
      loadSimpleItems(tx, m.householdId, "payment_methods"),
      loadSimpleItems(tx, m.householdId, "tags"),
      loadMembers(tx, m.householdId),
      loadFormOptions(tx, m.householdId),
      lastPaymentMethodId(tx, m.householdId, m.userId),
    ]);
    return { rows, groups, methods, tags, members, options, lastMethod };
  });
  const today = todayKST();
  const totals = sumByKind(rows);

  return (
    <div>
      <MonthNav month={month} basePath="/transactions" />
      <div className="mt-3">
        <ViewTabs month={month} active="list" />
      </div>

      <dl className={`mt-4 grid grid-cols-3 divide-x divide-border ${cardClass}`}>
        <Total label="수입" value={totals.income} />
        <Total label="저축" value={totals.saving} />
        <Total label="지출" value={totals.expense} />
      </dl>
      {totals.uncategorized > 0 ? (
        <p className="mt-2 text-sm text-danger">분류 필요 {formatWon(totals.uncategorized)}원</p>
      ) : null}

      <details className={`mt-4 ${cardClass}`} open={filtered}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          검색·필터{filtered ? " (적용 중)" : ""}
        </summary>
        <form method="get" className="grid grid-cols-2 gap-2 px-4 pb-4 lg:grid-cols-4">
          <input type="hidden" name="month" value={month} />
          <input
            name="q"
            defaultValue={filters.query ?? ""}
            placeholder="내용 검색"
            aria-label="내용 검색"
            className={`col-span-2 ${smallInputClass}`}
          />
          <select name="group" defaultValue={filters.groupId ?? ""} aria-label="대분류" className={smallInputClass}>
            <option value="">대분류 전체</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select name="cat" defaultValue={filters.categoryId ?? ""} aria-label="소분류" className={smallInputClass}>
            <option value="">소분류 전체</option>
            {groups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {g.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select name="pm" defaultValue={filters.paymentMethodId ?? ""} aria-label="지출방법" className={smallInputClass}>
            <option value="">지출방법 전체</option>
            {methods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select name="tag" defaultValue={filters.tagId ?? ""} aria-label="태그" className={smallInputClass}>
            <option value="">태그 전체</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {members.length > 1 ? (
            <select name="member" defaultValue={filters.createdBy ?? ""} aria-label="입력자" className={smallInputClass}>
              <option value="">입력자 전체</option>
              {members.map((mem) => (
                <option key={mem.userId} value={mem.userId}>
                  {mem.displayName}
                </option>
              ))}
            </select>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="uncategorized" value="1" defaultChecked={filters.uncategorized} />
            분류 필요만
          </label>
          <div className="col-span-2 flex gap-2">
            <button type="submit" className={`flex-1 ${smallButtonClass}`}>
              적용
            </button>
            {filtered ? (
              <Link href={`/transactions?month=${month}`} className={`flex flex-1 items-center justify-center ${smallButtonClass}`}>
                초기화
              </Link>
            ) : null}
          </div>
        </form>
      </details>

      <div className="mt-3 flex justify-end">
        <Link href={`/transactions/fixed-copy?month=${month}`} className="text-sm text-muted underline underline-offset-4">
          지난달 고정지출 가져오기
        </Link>
      </div>

      {/* PC: 표 위 한 줄 입력 */}
      <div className="mt-3 hidden lg:block">
        <QuickAdd
          groups={options.groups}
          paymentMethods={options.paymentMethods}
          defaultDate={today.startsWith(month) ? today : `${month}-01`}
          defaultPaymentMethodId={lastMethod}
          action={saveTransaction.bind(null, null)}
        />
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-center text-muted">{filtered ? "조건에 맞는 거래가 없어요." : "이 달에 입력한 거래가 없어요."}</p>
      ) : (
        <>
          <div className="mt-3 hidden lg:block">
            <TransactionTable rows={rows} />
          </div>
          <div className="mt-3 flex flex-col gap-4 lg:hidden">
            {groupByDate(rows).map((day) => (
              <section key={day.date}>
                <h2 className="flex justify-between px-1 text-sm text-muted">
                  <span>{formatDateLabel(day.date)}</span>
                  <DaySpend rows={day.rows} />
                </h2>
                <ul className={`mt-1 divide-y divide-border ${cardClass}`}>
                  {day.rows.map((r) => (
                    <li key={r.id}>
                      <TransactionItem row={r} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <Link
        href={`/transactions/new?month=${month}`}
        aria-label="거래 입력"
        className="fixed right-4 bottom-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl text-accent-foreground shadow-lg sm:right-[calc(50%-20rem)] lg:hidden"
      >
        +
      </Link>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 px-2 py-3 text-center">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold break-all tabular-nums">{formatWon(value)}</dd>
    </div>
  );
}

function DaySpend({ rows }: { rows: TransactionRow[] }) {
  const spend = rows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
  return spend > 0 ? <span className="tabular-nums">지출 {formatWon(spend)}</span> : null;
}

const AMOUNT_CLASS = { income: "text-accent", saving: "text-foreground", expense: "text-foreground" } as const;
const AMOUNT_SIGN = { income: "+", saving: "", expense: "-" } as const;

function TransactionItem({ row: r }: { row: TransactionRow }) {
  const title = r.categoryName ? `${r.groupName} · ${r.categoryName}` : "분류 필요";
  const sub = [r.memo, r.paymentMethodName, r.creatorName, r.receiptCount ? `영수증 ${r.receiptCount}` : null].filter(Boolean).join(" · ");
  return (
    <Link href={`/transactions/${r.id}`} className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${r.kind ? "" : "text-danger"}`}>
          {title}
          {r.groupKind === "fixed_expense" ? <span className="ml-1.5 text-xs text-muted">고정</span> : null}
          {r.kind === "saving" ? <span className="ml-1.5 text-xs text-muted">저축</span> : null}
        </p>
        {sub ? <p className="truncate text-sm text-muted">{sub}</p> : null}
        {r.tags.length > 0 ? (
          <p className="mt-1 flex flex-wrap gap-1">
            {r.tags.map((t) => (
              <span key={t.id} className="rounded bg-background px-1.5 py-0.5 text-xs text-muted">
                #{t.name}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <span className={`shrink-0 font-semibold tabular-nums ${r.kind ? AMOUNT_CLASS[r.kind] : "text-danger"}`}>
        {r.kind ? AMOUNT_SIGN[r.kind] : ""}
        {formatWon(r.amount)}
      </span>
    </Link>
  );
}

/** PC: 한 달 거래를 표로. 같은 날짜는 첫 줄에만 날짜를 쓰고, 줄을 누르면 수정 화면 */
function TransactionTable({ rows }: { rows: TransactionRow[] }) {
  return (
    <div className={`overflow-hidden ${cardClass}`}>
      <table className="w-full text-sm">
        <thead className="bg-background text-left text-xs text-muted">
          <tr>
            <th className="w-32 px-4 py-2 font-medium">날짜</th>
            <th className="px-3 py-2 font-medium">분류</th>
            <th className="px-3 py-2 font-medium">내용</th>
            <th className="px-3 py-2 font-medium">지출방법</th>
            <th className="px-3 py-2 font-medium">태그</th>
            <th className="px-3 py-2 font-medium">입력자</th>
            <th className="px-4 py-2 text-right font-medium">금액</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const firstOfDay = i === 0 || rows[i - 1].occurredOn !== r.occurredOn;
            return (
              <tr key={r.id} className={`relative hover:bg-background ${firstOfDay ? "border-t border-border" : ""}`}>
                <td className="px-4 py-2 whitespace-nowrap text-muted">{firstOfDay ? formatDateLabel(r.occurredOn) : ""}</td>
                <td className="px-3 py-2">
                  <Link href={`/transactions/${r.id}`} className={`after:absolute after:inset-0 ${r.kind ? "" : "text-danger"}`}>
                    {r.categoryName ? `${r.groupName} · ${r.categoryName}` : "분류 필요"}
                  </Link>
                  {r.groupKind === "fixed_expense" ? <span className="ml-1.5 text-xs text-muted">고정</span> : null}
                  {r.kind === "saving" ? <span className="ml-1.5 text-xs text-muted">저축</span> : null}
                </td>
                <td className="max-w-72 truncate px-3 py-2">
                  {r.memo}
                  {r.receiptCount ? <span className="ml-1.5 text-xs text-muted">영수증 {r.receiptCount}</span> : null}
                </td>
                <td className="px-3 py-2 text-muted">{r.paymentMethodName}</td>
                <td className="px-3 py-2 text-xs text-muted">{r.tags.map((t) => `#${t.name}`).join(" ")}</td>
                <td className="px-3 py-2 text-muted">{r.creatorName}</td>
                <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap tabular-nums ${r.kind ? AMOUNT_CLASS[r.kind] : "text-danger"}`}>
                  {r.kind ? AMOUNT_SIGN[r.kind] : ""}
                  {formatWon(r.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
