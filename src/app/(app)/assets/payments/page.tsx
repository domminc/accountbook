import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { formatDateLabel, parseMonth, todayKST } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { loadRecords } from "@/lib/data/finance";
import { loadDuePayments, type DuePayment } from "@/lib/data/payments";
import { loadCategoryGroups, loadSimpleItems } from "@/lib/data/settings";
import { ActionForm } from "@/components/action-form";
import { MonthNav } from "@/components/month-nav";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, primaryButtonClass } from "@/components/ui";
import { RecordList } from "../record-list";
import { paymentMethodOptions } from "../record-fields";
import { enterPayments } from "./actions";

const STATUS: Record<DuePayment["status"], { label: string; className: string }> = {
  entered: { label: "입력함", className: "text-accent" },
  upcoming: { label: "예정", className: "text-muted" },
  today: { label: "오늘", className: "text-warning font-semibold" },
  overdue: { label: "지남", className: "text-danger font-semibold" },
};

function statusText(p: DuePayment) {
  if (p.status === "upcoming") return `D-${p.daysLeft}`;
  return STATUS[p.status].label;
}

export default async function PaymentsPage({ searchParams }: PageProps<"/assets/payments">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = parseMonth(Array.isArray(params.month) ? params.month[0] : params.month);
  const today = todayKST();

  const data = await withUser(m.userId, async (tx) => {
    const [rules, due, groups, methods] = await Promise.all([
      loadRecords(tx, m.householdId, "recurring_payments"),
      loadDuePayments(tx, m.householdId, month, today),
      loadCategoryGroups(tx, m.householdId),
      loadSimpleItems(tx, m.householdId, "payment_methods"),
    ]);
    return { rules, due, groups, methods };
  });
  // 결제일 구분은 지출 소분류 (고정지출 먼저)
  const categories = data.groups
    .filter((g) => g.kind === "fixed_expense" || g.kind === "variable_expense")
    .map((g) => ({ label: g.name, options: g.categories.filter((c) => !c.isHidden).map((c) => ({ id: c.id, name: c.name })) }));
  const catName = new Map(data.groups.flatMap((g) => g.categories.map((c) => [c.id, `${g.name} · ${c.name}`] as const)));
  const pending = data.due.filter((p) => p.status !== "entered");
  const total = data.due.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <MonthNav month={month} basePath="/assets/payments" title="결제일 관리" />

      <section className={`p-4 ${cardClass}`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">이번 달 결제</h2>
          <span className="text-sm text-muted tabular-nums">합계 {formatWon(total)}</span>
        </div>
        {data.due.length === 0 ? (
          <p className="mt-2 text-sm text-muted">매달 챙기는 결제가 없어요. 아래에서 추가해 주세요.</p>
        ) : (
          <ActionForm action={enterPayments.bind(null, month)} className="mt-3 flex flex-col gap-3">
            <ul className="divide-y divide-border">
              {data.due.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-3 py-2">
                    {p.status === "entered" ? (
                      <span className="w-5 text-center text-accent" aria-hidden>
                        ✓
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        name="ids"
                        value={p.id}
                        defaultChecked={p.hasCategory && p.status !== "upcoming"}
                        disabled={!p.hasCategory}
                        className="h-5 w-5"
                        aria-label={`${p.content} 거래로 입력`}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.content}</span>
                      <span className="block truncate text-xs text-muted">
                        {formatDateLabel(p.date)}
                        {p.categoryName ? ` · ${p.categoryName}` : " · 구분을 정해야 입력할 수 있어요"}
                        {p.paymentMethodName ? ` · ${p.paymentMethodName}` : ""}
                        {p.accountNote ? ` · ${p.accountNote}` : ""}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold tabular-nums">{formatWon(p.amount)}</span>
                      {p.transactionId ? (
                        <Link href={`/transactions/${p.transactionId}`} className={`text-xs underline ${STATUS.entered.className}`}>
                          입력함
                        </Link>
                      ) : (
                        <span className={`text-xs ${STATUS[p.status].className}`}>{statusText(p)}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {pending.length > 0 ? <SubmitButton className={primaryButtonClass}>고른 결제를 거래로 입력</SubmitButton> : null}
          </ActionForm>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">결제 목록</h2>
        <RecordList
          kind="recurring_payments"
          rows={data.rules}
          categories={categories}
          paymentMethods={paymentMethodOptions(data.methods)}
          title={(r) => (
            <>
              {String(r.content)}
              {!r.is_active ? <span className="ml-1.5 text-xs font-normal text-muted">쉬는 중</span> : null}
            </>
          )}
          summary={(r) =>
            [
              `매월 ${Number(r.pay_day)}일`,
              formatWon(Number(r.amount)),
              r.category_id ? catName.get(String(r.category_id)) : "구분 없음",
              r.account_note ? String(r.account_note) : null,
            ]
              .filter(Boolean)
              .join(" · ")
          }
        />
      </section>
    </>
  );
}
