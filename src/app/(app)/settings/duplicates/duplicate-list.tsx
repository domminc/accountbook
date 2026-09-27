"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDateLabel, formatMonthLabel } from "@/lib/month";
import { formatWon } from "@/lib/money";
import type { DuplicateGroup } from "@/lib/data/duplicates";
import { cardClass, primaryButtonClass } from "@/components/ui";
import { deleteDuplicates } from "./actions";

const savedAt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );

/** 고정지출 묶음은 먼저 넣은 한 건만 남기고 나머지를 골라 둔다 */
function initialChecked(groups: DuplicateGroup[]): Set<string> {
  return new Set(groups.filter((g) => g.rows[0].fixed).flatMap((g) => g.rows.slice(1).map((r) => r.id)));
}

export function DuplicateList({ groups }: { groups: DuplicateGroup[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState(() => initialChecked(groups));
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  if (groups.length === 0) {
    return <p className={`p-6 text-center text-muted ${cardClass}`}>{message?.text ?? "중복으로 보이는 거래가 없어요."}</p>;
  }

  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  function remove() {
    const ids = [...checked];
    if (ids.length === 0 || !window.confirm(`고른 거래 ${ids.length}건을 지울까요?`)) return;
    setMessage(null);
    startTransition(async () => {
      const r = await deleteDuplicates(ids);
      if (r.error) {
        setMessage({ text: r.error, error: true });
        return;
      }
      setChecked(new Set());
      setMessage({ text: `거래 ${r.removed ?? ids.length}건을 지웠어요.`, error: false });
      router.refresh();
    });
  }

  const total = groups.reduce((s, g) => s + g.rows.length, 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        중복 의심 {groups.length}묶음 · 거래 {total}건
      </p>
      {message ? (
        <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-danger" : "text-muted"}`}>
          {message.text}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {groups.map((g) => {
          const first = g.rows[0];
          return (
            <li key={g.key} className={`p-4 ${cardClass}`}>
              <p className="font-medium">
                {formatMonthLabel(g.month)} · {first.groupName ? `${first.groupName} · ${first.categoryName}` : "미분류"} ·{" "}
                {first.memo || "내용 없음"} · {formatWon(first.amount)}원 <span className="text-muted">({g.rows.length}건)</span>
              </p>
              <ul className="mt-2 divide-y divide-border">
                {g.rows.map((r, i) => (
                  <li key={r.id}>
                    <label className="flex items-start gap-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked.has(r.id)}
                        onChange={(e) => toggle(r.id, e.target.checked)}
                        aria-label={`${first.memo || "내용 없음"} ${formatDateLabel(r.occurredOn)} ${i + 1}번째 지우기`}
                        className="mt-0.5 size-4"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block">
                          {formatDateLabel(r.occurredOn)} · {r.source}
                        </span>
                        <span className="block text-xs text-muted">
                          {savedAt(r.createdAt)} 넣음{r.createdBy ? ` · ${r.createdBy}` : ""}
                          {i === 0 ? " · 가장 먼저 넣은 것" : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={remove} disabled={pending || checked.size === 0} className={primaryButtonClass}>
        {pending ? "지우는 중…" : `고른 ${checked.size}건 지우기`}
      </button>
    </div>
  );
}
