"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { KIND_LABEL } from "@/lib/data/settings";
import { formatWon } from "@/lib/money";
import { smallInputClass } from "@/components/ui";
import type { TransactionActionState } from "./actions";
import type { FormGroup, FormOption } from "./transaction-form";

// 지출 먼저 (가장 많이 입력한다)
const GROUP_ORDER = ["variable_expense", "fixed_expense", "income", "saving"];

/**
 * PC 내역 표 위의 한 줄 입력 (시트처럼 이어서 입력).
 * 저장하면 날짜·소분류·지출방법은 남기고 금액·내용만 비운 뒤 금액 칸으로 돌아간다.
 */
export function QuickAdd({
  groups,
  paymentMethods,
  defaultDate,
  defaultPaymentMethodId,
  action,
}: {
  groups: FormGroup[];
  paymentMethods: FormOption[];
  defaultDate: string;
  defaultPaymentMethodId: string | null;
  action: (prev: TransactionActionState, formData: FormData) => Promise<TransactionActionState>;
}) {
  const [occurredOn, setOccurredOn] = useState(defaultDate);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(defaultPaymentMethodId ?? "");
  const [memo, setMemo] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  const sorted = [...groups].sort((a, b) => GROUP_ORDER.indexOf(a.kind) - GROUP_ORDER.indexOf(b.kind));
  const expense = new Set(
    groups.filter((g) => g.kind === "fixed_expense" || g.kind === "variable_expense").flatMap((g) => g.categories.map((c) => c.id)),
  );
  const isExpense = !categoryId || expense.has(categoryId);

  const [state, formAction, pending] = useActionState<TransactionActionState, FormData>(async (prev, formData) => {
    let r: TransactionActionState;
    try {
      r = await action(prev, formData);
    } catch (e) {
      if (e instanceof TypeError) return { error: "인터넷 연결이 없어요. 연결이 없을 때는 거래 입력 화면을 써 주세요." };
      throw e;
    }
    if (!r.error) {
      setAmount("");
      setMemo("");
      requestAnimationFrame(() => amountRef.current?.focus());
    }
    return r;
  }, {});

  return (
    <form
      aria-label="빠른 입력"
      // action={…} 으로 넘기면 React 가 저장 뒤 폼을 초기화해 소분류 선택까지 지운다. 직접 보낸다.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="rounded-2xl border border-border bg-surface p-3"
    >
      <input type="hidden" name="intent" value="more" />
      <div className="grid grid-cols-[8.5rem_minmax(8rem,1.2fr)_7rem_minmax(7rem,1fr)_minmax(8rem,1.5fr)_auto] items-center gap-2">
        <input
          type="date"
          name="occurredOn"
          required
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          aria-label="날짜"
          className={smallInputClass}
        />
        <select
          name="categoryId"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="소분류"
          className={smallInputClass}
        >
          <option value="">소분류 고르기</option>
          {sorted.map((g) => (
            <optgroup key={g.id} label={`${g.name} (${KIND_LABEL[g.kind]})`}>
              {g.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          ref={amountRef}
          name="amount"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="금액"
          value={amount}
          onChange={(e) => {
            const d = e.target.value.replace(/[^\d]/g, "").slice(0, 13);
            setAmount(d ? formatWon(Number(d)) : "");
          }}
          aria-label="금액"
          className={`text-right ${smallInputClass}`}
        />
        <select
          name="paymentMethodId"
          value={isExpense ? paymentMethodId : ""}
          disabled={!isExpense}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          aria-label="지출방법"
          className={`${smallInputClass} disabled:opacity-50`}
        >
          <option value="">지출방법 없음</option>
          {paymentMethods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          name="memo"
          maxLength={200}
          placeholder="내용 (Enter 로 추가)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          aria-label="내용"
          className={smallInputClass}
        />
        <button type="submit" disabled={pending} className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60">
          {pending ? "저장 중…" : "추가"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      ) : state.savedAt ? (
        <p role="status" className="mt-2 text-sm text-accent">
          추가했어요. 이어서 입력하세요.
        </p>
      ) : null}
    </form>
  );
}
