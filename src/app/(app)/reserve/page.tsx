import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { formatDateLabel, todayKST } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { loadReserveCategories, loadReserveEntries, type ReserveCategory, type ReserveEntry } from "@/lib/data/reserve";
import { reserveSummary } from "@/lib/annual";
import { ActionForm } from "@/components/action-form";
import { AmountInput } from "@/components/amount-input";
import { SubmitButton } from "@/components/submit-button";
import { YearNav, parseYear } from "@/components/year-nav";
import { cardClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { EditableRow } from "../settings/editable-row";
import {
  addReserveCategory,
  addReserveEntry,
  deleteReserveCategory,
  deleteReserveEntry,
  moveReserveCategory,
  renameReserveCategory,
  setReserveNote,
} from "./actions";

export default async function ReservePage({ searchParams }: PageProps<"/reserve">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const today = todayKST();
  const year = parseYear(params.year, today);
  const range = { start: `${year}-01-01`, end: `${year}-12-31` };

  const { categories, entries } = await withUser(m.userId, async (tx) => {
    const [categories, entries] = await Promise.all([loadReserveCategories(tx, m.householdId), loadReserveEntries(tx, m.householdId, range)]);
    return { categories, entries };
  });
  const summary = reserveSummary(entries, categories);
  const defaultDate = today.startsWith(`${year}-`) ? today : range.start;

  return (
    <div className="flex flex-col gap-5">
      <YearNav year={year} basePath="/reserve" title="예비비" />
      <p className="-mt-3 text-center text-xs text-muted">월 생활비와 따로 관리하는 목돈. 지출은 연간 총 지출과 달력에 들어가요.</p>

      <dl className={`grid grid-cols-3 divide-x divide-border text-center ${cardClass}`}>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">총 입금</dt>
          <dd className="font-semibold tabular-nums">{formatWon(summary.totalIn)}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">총 지출</dt>
          <dd className="font-semibold tabular-nums">{formatWon(summary.totalOut)}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">총 잔액</dt>
          <dd className={`font-semibold tabular-nums ${summary.totalBalance < 0 ? "text-danger" : ""}`}>{formatWon(summary.totalBalance)}</dd>
        </div>
      </dl>

      <section>
        <h2 className="font-semibold">분류별</h2>
        <p className="text-xs text-muted">잔액 = 입금(또는 예산) − 지출. 지출이 더 많으면 0으로 보여요.</p>
        {summary.rows.length > 0 ? (
          <ul className={`mt-2 divide-y divide-border ${cardClass}`}>
            {summary.rows.map((r, i) => (
              <li key={r.id}>
                <EditableRow
                  name={r.name}
                  rename={renameReserveCategory.bind(null, r.id)}
                  moveUp={i > 0 ? moveReserveCategory.bind(null, r.id, -1) : undefined}
                  moveDown={i < summary.rows.length - 1 ? moveReserveCategory.bind(null, r.id, 1) : undefined}
                  remove={deleteReserveCategory.bind(null, r.id)}
                  removeConfirm={`"${r.name}" 분류를 지울까요?`}
                  preview={
                    <span className="flex justify-between gap-2 text-sm text-muted">
                      <span>
                        입금 {formatWon(r.deposit)} · 지출 {formatWon(r.spent)}
                        {r.note ? ` · ${r.note}` : ""}
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">잔액 {formatWon(r.balance)}</span>
                    </span>
                  }
                >
                  <ActionForm action={setReserveNote.bind(null, r.id)} className="flex gap-2">
                    <input name="note" defaultValue={r.note ?? ""} maxLength={200} placeholder="비고" aria-label={`${r.name} 비고`} className={smallInputClass} />
                    <SubmitButton className={smallButtonClass}>비고 저장</SubmitButton>
                  </ActionForm>
                </EditableRow>
              </li>
            ))}
          </ul>
        ) : null}
        <ActionForm action={addReserveCategory} className={`mt-2 flex gap-2 p-3 ${cardClass}`}>
          <input name="name" required maxLength={30} placeholder="분류 추가 (예: 경조사)" aria-label="예비비 분류 추가" className={smallInputClass} />
          <SubmitButton className={smallButtonClass}>추가</SubmitButton>
        </ActionForm>
      </section>

      <EntrySection
        title="입금 내역"
        direction="in"
        year={year}
        defaultDate={defaultDate}
        categories={categories}
        entries={entries.filter((e) => e.direction === "in")}
      />
      <EntrySection
        title="지출 내역"
        direction="out"
        year={year}
        defaultDate={defaultDate}
        categories={categories}
        entries={entries.filter((e) => e.direction === "out")}
      />
    </div>
  );
}

function EntrySection({
  title,
  direction,
  year,
  defaultDate,
  categories,
  entries,
}: {
  title: string;
  direction: "in" | "out";
  year: number;
  defaultDate: string;
  categories: ReserveCategory[];
  entries: ReserveEntry[];
}) {
  const label = direction === "in" ? "입금" : "지출";
  return (
    <section className={`p-4 ${cardClass}`}>
      <h2 className="font-semibold">
        {title} <span className="text-sm font-normal text-muted">{entries.length}건</span>
      </h2>

      {categories.length === 0 ? (
        <p className="mt-2 text-sm text-muted">먼저 분류를 추가해 주세요.</p>
      ) : (
        <ActionForm action={addReserveEntry.bind(null, direction, year)} className="mt-3 grid grid-cols-2 gap-2">
          <input
            type="date"
            name="occurredOn"
            required
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            defaultValue={defaultDate}
            aria-label={`${label} 날짜`}
            className={smallInputClass}
          />
          <AmountInput name="amount" required aria-label={`${label} 금액`} className={smallInputClass} />
          <select name="categoryId" required defaultValue="" aria-label={`${label} 분류`} className={smallInputClass}>
            <option value="" disabled>
              분류
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="memo" maxLength={200} placeholder="내용" aria-label={`${label} 내용`} className={smallInputClass} />
          {direction === "out" ? (
            <input name="note" maxLength={200} placeholder="비고" aria-label="지출 비고" className={`col-span-2 ${smallInputClass}`} />
          ) : null}
          <SubmitButton className={`col-span-2 ${smallButtonClass}`}>{label} 추가</SubmitButton>
        </ActionForm>
      )}

      {entries.length > 0 ? (
        <ul className="mt-3 divide-y divide-border">
          {[...entries].reverse().map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-24 shrink-0 text-muted">{formatDateLabel(e.occurredOn)}</span>
              <span className="min-w-0 flex-1 truncate">
                {e.categoryName}
                {e.memo ? <span className="text-muted"> · {e.memo}</span> : null}
                {e.note ? <span className="text-muted"> · {e.note}</span> : null}
              </span>
              <span className="tabular-nums">{formatWon(e.amount)}</span>
              <ActionForm action={deleteReserveEntry.bind(null, e.id)}>
                <SubmitButton className="px-1 text-danger" confirmMessage="이 내역을 지울까요?" aria-label={`${formatDateLabel(e.occurredOn)} ${e.categoryName} 삭제`}>
                  ×
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
