"use client";

import { useState, useTransition } from "react";
import { formatDateLabel } from "@/lib/month";
import { formatWon } from "@/lib/money";
import type { PasteRow } from "@/lib/sms-suggest";
import { KIND_LABEL } from "@/lib/data/settings";
import { inputClass, primaryButtonClass, secondaryButtonClass, smallInputClass } from "@/components/ui";
import type { FormGroup, FormOption } from "../transaction-form";
import { analyzePaste, dismissSms, savePasted, type InboxRow } from "./actions";

type Row = {
  /** 받은 문자는 문자 id, 붙여 넣은 것은 순번 (서버·브라우저에서 같은 값이어야 한다) */
  key: string;
  source: PasteRow;
  /** 자동으로 받은 문자면 그 id */
  messageId: string | null;
  tagIds: string[];
  include: boolean;
  date: string;
  amount: string;
  memo: string;
  categoryId: string;
  paymentMethodId: string;
};

// 지출 먼저 (문자는 대부분 카드 지출)
const GROUP_ORDER = ["variable_expense", "fixed_expense", "income", "saving"];

let nextKey = 0;
function toRow(s: PasteRow, messageId: string | null): Row {
  return {
    key: messageId ?? `p${nextKey++}`,
    source: s,
    messageId,
    tagIds: s.tagIds,
    // 취소 문자·원화 금액이 없는 문자·이미 입력한 것 같은 문자는 빼 둔다
    include: !s.cancelled && s.amount !== null && !s.duplicateOf,
    date: s.date,
    amount: s.amount ? formatWon(s.amount) : "",
    memo: s.merchant,
    categoryId: s.categoryId ?? "",
    paymentMethodId: s.paymentMethodId ?? "",
  };
}

export function PasteForm({
  groups,
  paymentMethods,
  tags,
  inbox,
}: {
  groups: FormGroup[];
  paymentMethods: FormOption[];
  tags: FormOption[];
  inbox: InboxRow[];
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(() => (inbox.length > 0 ? inbox.map((r) => toRow(r, r.messageId)) : null));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sortedGroups = [...groups].sort((a, b) => GROUP_ORDER.indexOf(a.kind) - GROUP_ORDER.indexOf(b.kind));
  const expenseCategory = new Set(
    groups.filter((g) => g.kind === "fixed_expense" || g.kind === "variable_expense").flatMap((g) => g.categories.map((c) => c.id)),
  );

  function analyze() {
    setError(null);
    startTransition(async () => {
      const r = await analyzePaste(text);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      // 자동으로 받은 문자는 남기고, 붙여 넣은 것만 새로
      setRows((prev) => [...(prev ?? []).filter((x) => x.messageId), ...r.rows.map((x) => toRow(x, null))]);
    });
  }

  function dismiss(row: Row) {
    if (!row.messageId || !window.confirm("이 문자를 저장하지 않고 버릴까요?")) return;
    setError(null);
    startTransition(async () => {
      const r = await dismissSms([row.messageId!]);
      if (r.error) setError(r.error);
      else setRows((prev) => prev?.filter((x) => x.key !== row.key) ?? null);
    });
  }

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  }

  const chosen = rows?.filter((r) => r.include) ?? [];

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await savePasted(
        chosen.map((c) => ({
          date: c.date,
          amount: Number(c.amount.replace(/[^\d]/g, "")),
          memo: c.memo,
          categoryId: c.categoryId,
          paymentMethodId: expenseCategory.has(c.categoryId) && c.paymentMethodId ? c.paymentMethodId : null,
          tagIds: c.tagIds,
          messageId: c.messageId,
        })),
      );
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="text-sm font-medium">문자 내용</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={20_000}
          placeholder={"[Web발신]\n신한카드(1234)승인 홍*동 12,500원(일시불)09/26 12:34 스타벅스 누적1,234,567원"}
          className={`mt-1 ${inputClass} h-auto py-2 text-sm`}
        />
      </label>
      <button type="button" onClick={analyze} disabled={pending || !text.trim()} className={secondaryButtonClass}>
        {pending && !rows ? "읽는 중…" : "문자 읽기"}
      </button>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {rows ? (
        <>
          <h2 className="mt-2 font-semibold">찾은 거래 {rows.length}건</h2>
          {rows.some((r) => r.messageId) ? (
            <p className="-mt-2 text-sm text-muted">
              자동으로 받은 문자 중 확인이 필요한 {rows.filter((r) => r.messageId).length}건이 포함돼 있어요.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => {
              const s = r.source;
              const id = `paste-${r.key}`;
              const n = `${i + 1}번째`;
              const disabled = s.cancelled;
              return (
                <li key={r.key} className={`rounded-2xl border border-border bg-surface p-4 ${r.include ? "" : "opacity-70"}`}>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={r.include}
                      disabled={disabled}
                      onChange={(e) => update(r.key, { include: e.target.checked })}
                      className="mt-1 size-4"
                      aria-label={`${n} 거래 저장`}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">
                        {s.merchant || "가맹점 모름"} {s.amount !== null ? `${formatWon(s.amount)}원` : ""}
                      </span>
                      <span className="block text-xs text-muted">
                        {[formatDateLabel(s.date) + (s.time ? ` ${s.time}` : ""), s.issuer, s.installment, r.messageId ? "자동으로 받음" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {r.messageId ? (
                      <button
                        type="button"
                        onClick={() => dismiss(r)}
                        disabled={pending}
                        aria-label={`${n} 받은 문자 버리기`}
                        className="shrink-0 text-xs text-muted underline underline-offset-4"
                      >
                        버리기
                      </button>
                    ) : null}
                  </label>

                  {s.cancelled ? (
                    <p className="mt-2 text-xs text-warning">취소 문자예요. 원래 거래를 내역에서 찾아 지워 주세요.</p>
                  ) : null}
                  {s.amount === null ? <p className="mt-2 text-xs text-warning">원화 금액을 찾지 못했어요. 금액을 넣어 주세요.</p> : null}
                  {s.dateGuessed ? <p className="mt-2 text-xs text-warning">날짜를 찾지 못해 오늘로 두었어요.</p> : null}
                  {s.duplicateOf ? (
                    <p className="mt-2 text-xs text-warning">같은 날 같은 금액 거래가 이미 있어요 ({s.duplicateOf}). 확인 후 저장하세요.</p>
                  ) : null}

                  {!disabled ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`${id}-date`} className="text-xs text-muted">
                          날짜
                        </label>
                        <input
                          id={`${id}-date`}
                          type="date"
                          value={r.date}
                          aria-label={`${n} 날짜`}
                          onChange={(e) => update(r.key, { date: e.target.value })}
                          className={`mt-0.5 ${smallInputClass}`}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${id}-amount`} className="text-xs text-muted">
                          금액
                        </label>
                        <input
                          id={`${id}-amount`}
                          inputMode="numeric"
                          value={r.amount}
                          aria-label={`${n} 금액`}
                          onChange={(e) => {
                            const d = e.target.value.replace(/[^\d]/g, "").slice(0, 13);
                            update(r.key, { amount: d ? formatWon(Number(d)) : "" });
                          }}
                          className={`mt-0.5 text-right ${smallInputClass}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <label htmlFor={`${id}-memo`} className="text-xs text-muted">
                          내용
                        </label>
                        <input
                          id={`${id}-memo`}
                          value={r.memo}
                          maxLength={200}
                          aria-label={`${n} 내용`}
                          onChange={(e) => update(r.key, { memo: e.target.value })}
                          className={`mt-0.5 ${smallInputClass}`}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${id}-cat`} className="text-xs text-muted">
                          소분류
                        </label>
                        <select
                          id={`${id}-cat`}
                          value={r.categoryId}
                          aria-label={`${n} 소분류`}
                          onChange={(e) => update(r.key, { categoryId: e.target.value })}
                          className={`mt-0.5 ${smallInputClass}`}
                        >
                          <option value="">고르기</option>
                          {sortedGroups.map((g) => (
                            <optgroup key={g.id} label={`${g.name} (${KIND_LABEL[g.kind]})`}>
                              {g.categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`${id}-pm`} className="text-xs text-muted">
                          지출방법
                        </label>
                        <select
                          id={`${id}-pm`}
                          value={r.paymentMethodId}
                          aria-label={`${n} 지출방법`}
                          disabled={!!r.categoryId && !expenseCategory.has(r.categoryId)}
                          onChange={(e) => update(r.key, { paymentMethodId: e.target.value })}
                          className={`mt-0.5 ${smallInputClass} disabled:opacity-50`}
                        >
                          <option value="">선택 안 함</option>
                          {paymentMethods.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {tags.length > 0 ? (
                        <div className="col-span-2">
                          <span className="text-xs text-muted">태그</span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {tags.map((t) => {
                              const on = r.tagIds.includes(t.id);
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  role="checkbox"
                                  aria-checked={on}
                                  aria-label={`${n} 태그 ${t.name}`}
                                  onClick={() => update(r.key, { tagIds: on ? r.tagIds.filter((x) => x !== t.id) : [...r.tagIds, t.id] })}
                                  className={`h-8 rounded-full border px-3 text-xs ${
                                    on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface"
                                  }`}
                                >
                                  #{t.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={save} disabled={pending || chosen.length === 0} className={primaryButtonClass}>
            {pending ? "저장 중…" : `${chosen.length}건 저장`}
          </button>
        </>
      ) : null}
    </div>
  );
}
