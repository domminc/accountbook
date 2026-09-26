"use client";

import { useActionState, useEffect, useState } from "react";
import { TX_KIND_LABEL, txKindOf, type CategoryKind, type TxKind } from "@/lib/data/settings";
import { formatDateLabel, isValidDate, todayKST } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { enqueue, isNetworkError } from "@/lib/offline-queue";
import { RECEIPTS_PER_TRANSACTION } from "@/lib/receipt";
import { ReceiptPicker } from "@/components/receipt-picker";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { KeptValues, TransactionActionState } from "./actions";

export type FormGroup = { id: string; name: string; kind: CategoryKind; categories: { id: string; name: string }[] };
export type FormOption = { id: string; name: string };
export type FormInitial = {
  kind: TxKind;
  groupId: string | null;
  categoryId: string | null;
  occurredOn: string;
  amount: number | null;
  paymentMethodId: string | null;
  tagIds: string[];
  memo: string;
};

type Props = {
  groups: FormGroup[];
  paymentMethods: FormOption[];
  tags: FormOption[];
  initial: FormInitial;
  action: (prev: TransactionActionState, formData: FormData) => Promise<TransactionActionState>;
  /** 새 거래일 때만 "저장하고 계속 입력" */
  allowSaveMore: boolean;
  /** 새 거래: 연결이 없으면 이 사람의 기기 대기열에 저장한다 */
  offline?: { userId: string; renderedToday: string };
};

export function TransactionForm(props: Props) {
  // 새 거래에 붙일 영수증 (브라우저에서 줄인 것)
  const [receipts, setReceipts] = useState<Blob[]>([]);
  const clearOnSuccess = (r: TransactionActionState): TransactionActionState => {
    if (!r.error) setReceipts([]);
    return r;
  };
  const [state, formAction, pending] = useActionState<TransactionActionState, FormData>(async (prev, formData) => {
    receipts.forEach((b, i) => formData.append("receipt", b, `receipt-${i + 1}.jpg`));
    // crypto.randomUUID 는 https(또는 localhost)에서만 있다
    if (!props.offline || typeof crypto.randomUUID !== "function") return clearOnSuccess(await props.action(prev, formData));
    // 기기에서 id를 정해 두면, 응답을 못 받아 다시 올려도 한 번만 저장된다
    formData.set("clientId", crypto.randomUUID());
    if (navigator.onLine === false) return clearOnSuccess(saveOffline(props, formData));
    try {
      return clearOnSuccess(await props.action(prev, formData));
    } catch (e) {
      if (isNetworkError(e)) return clearOnSuccess(saveOffline(props, formData));
      throw e;
    }
  }, {});


  // 저장하고 계속 입력하면 날짜·유형·분류·지출방법은 남기고 금액·내용·태그는 비운 새 폼을 띄운다
  const initial = state.kept ? fromKept(state.kept) : props.initial;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Fields key={state.savedAt ?? 0} {...props} initial={initial} />

      {props.allowSaveMore ? <ReceiptPicker files={receipts} onChange={setReceipts} max={RECEIPTS_PER_TRANSACTION} /> : null}

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : state.message ? (
        <p role="status" className="text-sm text-accent">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" name="intent" value="save" disabled={pending} className={`sm:flex-1 ${primaryButtonClass}`}>
          {pending ? "저장 중…" : "저장"}
        </button>
        {props.allowSaveMore ? (
          <button type="submit" name="intent" value="more" disabled={pending} className={`sm:flex-1 ${secondaryButtonClass}`}>
            저장하고 계속 입력
          </button>
        ) : null}
      </div>
    </form>
  );
}

function fromKept(k: KeptValues): FormInitial {
  return { ...k, amount: null, tagIds: [], memo: "" };
}

/** 연결이 없을 때: 이 기기에 저장하고, 날짜·분류·지출방법은 남긴 새 폼을 띄운다 */
function saveOffline(props: Props, formData: FormData): TransactionActionState {
  const categoryId = String(formData.get("categoryId") ?? "");
  const group = props.groups.find((g) => g.categories.some((c) => c.id === categoryId));
  const category = group?.categories.find((c) => c.id === categoryId);
  const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d]/g, ""));
  const occurredOn = String(formData.get("occurredOn") ?? "");
  if (!isValidDate(occurredOn)) return { error: "날짜를 확인해 주세요." };
  if (!group || !category) return { error: "소분류를 골라 주세요." };
  if (!amount) return { error: "금액을 1원 ~ 1조 원 사이로 입력해 주세요." };

  const hadReceipt = formData.getAll("receipt").length > 0;
  const entries = [...formData.entries()]
    .filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$ACTION"))
    .filter(([k]) => k !== "intent");
  const memo = String(formData.get("memo") ?? "").trim();
  const ok = enqueue({
    clientId: String(formData.get("clientId")),
    userId: props.offline!.userId,
    entries,
    label: `${formatDateLabel(occurredOn)} ${group.name} · ${category.name} ${formatWon(amount)}원${memo ? ` · ${memo}` : ""}`,
    queuedAt: Date.now(),
  });
  if (!ok) return { error: "인터넷 연결이 없고, 이 기기에도 저장하지 못했어요." };

  const kind = txKindOf(group.kind);
  const paymentMethodId = String(formData.get("paymentMethodId") ?? "") || null;
  return {
    savedAt: Date.now(),
    message:
      "인터넷 연결이 없어 이 기기에 저장했어요. 연결되면 자동으로 올려요." +
      (hadReceipt ? " 영수증 사진은 연결된 뒤 거래를 열어 다시 붙여 주세요." : ""),
    kept: { kind, groupId: group.id, categoryId, occurredOn, paymentMethodId },
  };
}

const KINDS: TxKind[] = ["expense", "income", "saving"];

function groupsOfKind(groups: FormGroup[], kind: TxKind) {
  return groups.filter((g) =>
    kind === "expense" ? g.kind === "fixed_expense" || g.kind === "variable_expense" : g.kind === kind,
  );
}

function Fields({ groups, paymentMethods, tags, initial, offline }: Props) {
  const [kind, setKind] = useState<TxKind>(initial.kind);
  const [groupId, setGroupId] = useState<string | null>(initial.groupId ?? autoGroup(groups, initial.kind));
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId);
  const [amount, setAmount] = useState(initial.amount ? formatWon(initial.amount) : "");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(initial.paymentMethodId);
  const [tagIds, setTagIds] = useState<string[]>(initial.tagIds);
  // React는 액션 후 비제어 입력을 초기화하므로, 오류가 나도 입력이 남도록 제어 입력으로 둔다
  const [occurredOn, setOccurredOn] = useState(initial.occurredOn);
  const [memo, setMemo] = useState(initial.memo);

  // 오프라인용으로 저장해 둔 화면은 며칠 전에 받은 것일 수 있다: "오늘"로 채웠던 날짜를 이 기기의 오늘로
  const renderedToday = offline?.renderedToday;
  useEffect(() => {
    const today = todayKST();
    // 서버가 그린 값과 맞춰 하이드레이션한 뒤에 기기 시계로 고친다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (renderedToday && renderedToday !== today && initial.occurredOn === renderedToday) setOccurredOn(today);
  }, [renderedToday, initial.occurredOn]);

  const visibleGroups = groupsOfKind(groups, kind);
  const group = groups.find((g) => g.id === groupId) ?? null;

  function changeKind(next: TxKind) {
    if (next === kind) return;
    setKind(next);
    setGroupId(autoGroup(groups, next));
    setCategoryId(null);
  }

  return (
    <>
      <div role="radiogroup" aria-label="유형" className="grid grid-cols-3 rounded-xl border border-border bg-surface p-1">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => changeKind(k)}
            className={`h-10 rounded-lg text-sm font-semibold ${kind === k ? "bg-accent text-accent-foreground" : "text-muted"}`}
          >
            {TX_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">날짜</span>
          <input
            type="date"
            name="occurredOn"
            required
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">금액</span>
          <div className="relative mt-1">
            <input
              name="amount"
              required
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 13);
                setAmount(digits ? formatWon(Number(digits)) : "");
              }}
              className={`${inputClass} pr-8 text-right font-semibold`}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">원</span>
          </div>
        </label>
      </div>

      <ChipGroup
        label="대분류"
        options={visibleGroups}
        selected={groupId ? [groupId] : []}
        onToggle={(id) => {
          setGroupId(id);
          const g = groups.find((x) => x.id === id);
          setCategoryId(g && g.categories.length === 1 ? g.categories[0].id : null);
        }}
      />

      {group ? (
        <ChipGroup
          label="소분류"
          options={group.categories}
          selected={categoryId ? [categoryId] : []}
          onToggle={(id) => setCategoryId(id)}
        />
      ) : null}
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />

      {kind === "expense" && paymentMethods.length > 0 ? (
        <ChipGroup
          label="지출방법"
          options={paymentMethods}
          selected={paymentMethodId ? [paymentMethodId] : []}
          onToggle={(id) => setPaymentMethodId(paymentMethodId === id ? null : id)}
        />
      ) : null}
      <input type="hidden" name="paymentMethodId" value={kind === "expense" ? (paymentMethodId ?? "") : ""} />

      {tags.length > 0 ? (
        <ChipGroup
          label="태그"
          options={tags}
          selected={tagIds}
          multiple
          onToggle={(id) => setTagIds(tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id])}
        />
      ) : null}
      {tagIds.map((id) => (
        <input key={id} type="hidden" name="tagIds" value={id} />
      ))}

      <label className="block">
        <span className="text-sm font-medium">내용</span>
        <input
          name="memo"
          maxLength={200}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 장보기"
          className={`mt-1 ${inputClass}`}
        />
      </label>
    </>
  );
}

/** 수입·저축처럼 대분류가 하나뿐이면 바로 고른다 */
function autoGroup(groups: FormGroup[], kind: TxKind): string | null {
  const list = groupsOfKind(groups, kind);
  return list.length === 1 ? list[0].id : null;
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
  multiple = false,
}: {
  label: string;
  options: FormOption[];
  selected: string[];
  onToggle: (id: string) => void;
  multiple?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={on}
              onClick={() => onToggle(o.id)}
              className={`h-10 rounded-full border px-4 text-sm ${
                on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface"
              }`}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
