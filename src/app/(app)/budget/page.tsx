import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { formatDateLabel, monthRange, parseMonth, todayKST } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { loadCategoryGroups, loadSimpleItems } from "@/lib/data/settings";
import { limitTargetNames, loadBudgets, loadEvents, loadGoals, loadSpendingLimits, type GoalKind } from "@/lib/data/plan";
import { listTransactions } from "@/lib/data/transactions";
import { spendByTarget } from "@/lib/overspend";
import { ActionForm } from "@/components/action-form";
import { AmountInput } from "@/components/amount-input";
import { MonthNav } from "@/components/month-nav";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, primaryButtonClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { addEvent, addSpendingLimit, copyPrevPlan, deleteEvent, deleteSpendingLimit, savePlan } from "./actions";

const GOAL_LABEL: Record<GoalKind, string> = { income: "수입", saving: "저축", expense: "지출" };

export default async function BudgetPage({ searchParams }: PageProps<"/budget">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = parseMonth(Array.isArray(params.month) ? params.month[0] : params.month);
  const range = monthRange(month);

  const { groups, budgets, goals, events, tags, limits, rows } = await withUser(m.userId, async (tx) => {
    const [groups, budgets, goals, events, tags, limits, rows] = await Promise.all([
      loadCategoryGroups(tx, m.householdId),
      loadBudgets(tx, m.householdId, month),
      loadGoals(tx, m.householdId, month),
      loadEvents(tx, m.householdId, range),
      loadSimpleItems(tx, m.householdId, "tags"),
      loadSpendingLimits(tx, m.householdId),
      listTransactions(tx, m.householdId, range),
    ]);
    return { groups, budgets, goals, events, tags, limits, rows };
  });
  const targetNames = limitTargetNames(groups, tags);
  const spent = spendByTarget(rows);
  const limitedKeys = new Set(limits.map((l) => `${l.type}:${l.id}`));
  const budgetGroups = groups.filter(
    (g) => (g.kind === "fixed_expense" || g.kind === "variable_expense") && (!g.isHidden || budgets.has(g.id)),
  );
  const variableTotal = budgetGroups.filter((g) => g.kind === "variable_expense").reduce((s, g) => s + (budgets.get(g.id) ?? 0), 0);
  const today = todayKST();

  return (
    <div>
      <MonthNav month={month} basePath="/budget" title="목표·예산" />
      <Link href={`/?month=${month}`} className="mt-1 block text-center text-sm text-muted underline underline-offset-4">
        이달의 정리 보기
      </Link>

      <ActionForm action={copyPrevPlan.bind(null, month)} className="mt-4 flex justify-end">
        <SubmitButton className={smallButtonClass}>지난달 목표·예산 가져오기</SubmitButton>
      </ActionForm>

      <ActionForm action={savePlan.bind(null, month)} className="mt-3 flex flex-col gap-5">
        <section className={`p-4 ${cardClass}`}>
          <h2 className="font-semibold">목표</h2>
          <p className="mt-1 text-xs text-muted">이달의 정리에서 목표 대비 실적과 달성률을 보여줘요.</p>
          <div className="mt-3 flex flex-col gap-4">
            {(Object.keys(GOAL_LABEL) as GoalKind[]).map((kind) => (
              <div key={kind} className="grid grid-cols-[3.5rem_1fr] items-start gap-x-3 gap-y-2">
                <span className="pt-2.5 text-sm font-medium">{GOAL_LABEL[kind]}</span>
                <AmountInput
                  name={`goal_${kind}`}
                  defaultValue={goals[kind]?.amount}
                  aria-label={`${GOAL_LABEL[kind]} 목표`}
                  className={smallInputClass}
                />
                <input
                  name={`note_${kind}`}
                  defaultValue={goals[kind]?.note ?? ""}
                  maxLength={500}
                  placeholder="세부 목표 (선택)"
                  aria-label={`${GOAL_LABEL[kind]} 세부 목표`}
                  className={`col-start-2 ${smallInputClass}`}
                />
              </div>
            ))}
          </div>
        </section>

        <section className={`p-4 ${cardClass}`}>
          <h2 className="font-semibold">대분류별 예산</h2>
          <p className="mt-1 text-xs text-muted">비워 두면 예산 없음. 비고정지출 예산 합계 {formatWon(variableTotal)}원</p>
          <div className="mt-3 flex flex-col gap-2">
            {budgetGroups.map((g) => (
              <label key={g.id} className="grid grid-cols-[1fr_9rem] items-center gap-3">
                <span className="text-sm">
                  {g.name}
                  {g.kind === "fixed_expense" ? <span className="ml-1 text-xs text-muted">고정</span> : null}
                </span>
                <AmountInput name={`budget_${g.id}`} defaultValue={budgets.get(g.id)} aria-label={`${g.name} 예산`} className={smallInputClass} />
              </label>
            ))}
          </div>
        </section>

        <SubmitButton className={primaryButtonClass}>목표·예산 저장</SubmitButton>
      </ActionForm>

      <section className={`mt-6 p-4 ${cardClass}`}>
        <h2 className="font-semibold">과소비 알림 한도</h2>
        <p className="mt-1 text-xs text-muted">
          소분류나 태그에 매월 한도를 정하면 80%를 넘을 때와 초과했을 때 이달의 정리에서 알려줘요. 한도가 없는 항목은 지난 3개월
          평균보다 많이 쓰면 알려줘요.
        </p>
        {limits.length > 0 ? (
          <ul className="mt-3 divide-y divide-border">
            {limits.map((l) => {
              const name = targetNames.get(`${l.type}:${l.id}`) ?? "(지운 항목)";
              const used = spent.get(`${l.type}:${l.id}`) ?? 0;
              return (
                <li key={l.limitId} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    {name}
                    <span className="block text-xs text-muted tabular-nums">
                      이 달 {formatWon(used)} / 한도 {formatWon(l.amount)}
                    </span>
                  </span>
                  <ActionForm action={deleteSpendingLimit.bind(null, l.limitId)}>
                    <SubmitButton className="px-2 text-sm text-danger" confirmMessage="이 한도를 지울까요?" aria-label={`${name} 한도 삭제`}>
                      삭제
                    </SubmitButton>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        ) : null}
        <ActionForm action={addSpendingLimit} className="mt-3 grid grid-cols-2 gap-2" resetOnSuccess>
          <select name="target" required defaultValue="" aria-label="한도 항목" className={`col-span-2 ${smallInputClass}`}>
            <option value="" disabled>
              소분류·태그 고르기
            </option>
            {groups
              .filter((g) => (g.kind === "fixed_expense" || g.kind === "variable_expense") && !g.isHidden)
              .map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {g.categories
                    .filter((c) => !c.isHidden && !limitedKeys.has(`category:${c.id}`))
                    .map((c) => (
                      <option key={c.id} value={`category:${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            {tags.some((t) => !t.isHidden && !limitedKeys.has(`tag:${t.id}`)) ? (
              <optgroup label="태그">
                {tags
                  .filter((t) => !t.isHidden && !limitedKeys.has(`tag:${t.id}`))
                  .map((t) => (
                    <option key={t.id} value={`tag:${t.id}`}>
                      #{t.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
          </select>
          <AmountInput name="amount" aria-label="월 한도" placeholder="월 한도" className={smallInputClass} />
          <SubmitButton className={smallButtonClass}>한도 추가</SubmitButton>
        </ActionForm>
      </section>

      <section className={`mt-6 p-4 ${cardClass}`}>
        <h2 className="font-semibold">이달의 이벤트</h2>
        <p className="mt-1 text-xs text-muted">생일, 여행처럼 미리 챙길 일정과 예산을 적어 두세요.</p>
        {events.length > 0 ? (
          <ul className="mt-3 divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="w-24 shrink-0 text-sm text-muted">{formatDateLabel(e.occurredOn)}</span>
                <span className="min-w-0 flex-1 truncate">{e.content}</span>
                {e.budget ? <span className="text-sm tabular-nums">{formatWon(e.budget)}</span> : null}
                <ActionForm action={deleteEvent.bind(null, e.id)}>
                  <SubmitButton className="px-2 text-sm text-danger" confirmMessage="이 이벤트를 지울까요?" aria-label={`${e.content} 삭제`}>
                    삭제
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : null}
        <ActionForm action={addEvent.bind(null, month)} className="mt-3 grid grid-cols-2 gap-2">
          <input
            type="date"
            name="occurredOn"
            required
            min={range.start}
            max={range.end}
            defaultValue={today.startsWith(month) ? today : range.start}
            aria-label="이벤트 날짜"
            className={smallInputClass}
          />
          <AmountInput name="budget" aria-label="이벤트 예산" placeholder="예산 (선택)" className={smallInputClass} />
          <input name="content" required maxLength={200} placeholder="내용 (예: 어머니 생신)" aria-label="이벤트 내용" className={`col-span-2 ${smallInputClass}`} />
          <SubmitButton className={`col-span-2 ${smallButtonClass}`}>이벤트 추가</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
