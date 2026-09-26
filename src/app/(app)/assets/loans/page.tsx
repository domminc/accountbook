import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { formatDateLabel, todayKST } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { formatPercent } from "@/lib/format";
import { loanStatus } from "@/lib/finance";
import { loadRecords, loadRepayments } from "@/lib/data/finance";
import { ActionForm } from "@/components/action-form";
import { AmountInput } from "@/components/amount-input";
import { Meter } from "@/components/meter";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { RecordList } from "../record-list";
import { addRepayment, deleteRepayment } from "./actions";

export default async function LoansPage() {
  const m = await requireHousehold();
  const { loans, repayments } = await withUser(m.userId, async (tx) => {
    const [loans, repayments] = await Promise.all([loadRecords(tx, m.householdId, "loans"), loadRepayments(tx, m.householdId)]);
    return { loans, repayments };
  });
  const statusOf = (loan: (typeof loans)[number]) =>
    loanStatus(Number(loan.principal), repayments.filter((r) => r.loanId === loan.id));
  const totals = loans.reduce(
    (t, l) => {
      const s = statusOf(l);
      return { principal: t.principal + Number(l.principal), balance: t.balance + s.balance, interest: t.interest + s.interest };
    },
    { principal: 0, balance: 0, interest: 0 },
  );
  const today = todayKST();

  return (
    <>
      <dl className={`grid grid-cols-3 divide-x divide-border text-center ${cardClass}`}>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">총 대출 원금</dt>
          <dd className="font-semibold tabular-nums">{formatWon(totals.principal)}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">총 원금 잔액</dt>
          <dd className="font-semibold tabular-nums">{formatWon(totals.balance)}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">총 누적 이자</dt>
          <dd className="font-semibold tabular-nums">{formatWon(totals.interest)}</dd>
        </div>
      </dl>
      <p className="-mt-3 text-xs text-muted">상환할 때마다 상환원금·이자를 기록하면 원금잔액과 누적이자가 계산돼요.</p>

      <RecordList
        kind="loans"
        rows={loans}
        title={(l) => (
          <>
            {String(l.name)}
            {l.lender ? <span className="ml-1.5 text-sm font-normal text-muted">{String(l.lender)}</span> : null}
          </>
        )}
        summary={(l) => {
          const s = statusOf(l);
          return (
            <span className="flex flex-col gap-1">
              <span className="flex justify-between gap-2">
                <span>
                  원금 {formatWon(Number(l.principal))}
                  {l.rate_percent !== null ? ` · 금리 ${Number(l.rate_percent)}%` : ""}
                  {l.payment_day ? ` · ${String(l.payment_day)}` : ""}
                </span>
                <span className="font-semibold text-foreground tabular-nums">잔액 {formatWon(s.balance)}</span>
              </span>
              <Meter value={s.repaid} max={Number(l.principal)} kind="target" label={`${String(l.name)} 상환 진행`} />
              <span className="text-xs">
                상환 {formatPercent(s.progress)} · 누적이자 {formatWon(s.interest)}
              </span>
            </span>
          );
        }}
        extra={(l) => {
          const list = repayments.filter((r) => r.loanId === l.id);
          return (
            <section className="rounded-xl border border-border p-3">
              <h3 className="text-sm font-medium">상환 기록</h3>
              <ActionForm action={addRepayment.bind(null, l.id)} className="mt-2 grid grid-cols-2 gap-2" resetOnSuccess>
                <input type="date" name="paidOn" required defaultValue={today} aria-label="상환일" className={smallInputClass} />
                <input name="note" maxLength={200} placeholder="비고" aria-label="상환 비고" className={smallInputClass} />
                <AmountInput name="principal" aria-label="상환원금" placeholder="상환원금" className={smallInputClass} />
                <AmountInput name="interest" aria-label="이자" placeholder="이자" className={smallInputClass} />
                <SubmitButton className={`col-span-2 ${smallButtonClass}`}>상환 기록 추가</SubmitButton>
              </ActionForm>
              {list.length > 0 ? (
                <ul className="mt-2 divide-y divide-border text-sm">
                  {list.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 py-1.5">
                      <span className="w-24 shrink-0 text-muted">{formatDateLabel(r.paidOn)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        원금 {formatWon(r.principal)} · 이자 {formatWon(r.interest)}
                        {r.note ? <span className="text-muted"> · {r.note}</span> : null}
                      </span>
                      <ActionForm action={deleteRepayment.bind(null, r.id)}>
                        <SubmitButton className="px-1 text-danger" confirmMessage="이 상환 기록을 지울까요?" aria-label={`${formatDateLabel(r.paidOn)} 상환 기록 삭제`}>
                          ×
                        </SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        }}
      />
    </>
  );
}
