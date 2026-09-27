"use client";

import { useState, useTransition } from "react";
import { formatDateLabel } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { cardClass } from "@/components/ui";
import { undoEntryBatch, type EntryBatch } from "./actions";

const SOURCE_LABEL: Record<EntryBatch["source"], string> = { file: "파일", text: "문자", earlier: "한꺼번에 저장" };

const savedAt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );

/** 최근에 한꺼번에 저장한 거래 묶음과 되돌리기 */
export function EntryBatches({ batches }: { batches: EntryBatch[] }) {
  const [list, setList] = useState(batches);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  if (list.length === 0 && !message) return null;

  function undo(b: EntryBatch) {
    const what = b.fileName ?? `${SOURCE_LABEL[b.source]} ${savedAt(b.createdAt)}`;
    if (!window.confirm(`${what}에서 저장한 거래 ${b.count}건(${formatWon(b.total)}원)을 모두 지울까요?`)) return;
    setMessage(null);
    startTransition(async () => {
      const r = await undoEntryBatch(b.id);
      if (r.error) {
        setMessage({ text: r.error, error: true });
        return;
      }
      setList((prev) => prev.filter((x) => x.id !== b.id));
      setMessage({ text: `거래 ${r.removed ?? b.count}건을 지웠어요.`, error: false });
    });
  }

  return (
    <section aria-labelledby="entry-batches" className={`mt-8 p-4 ${cardClass}`}>
      <h2 id="entry-batches" className="font-semibold">
        최근에 한꺼번에 저장한 거래
      </h2>
      <p className="mt-0.5 text-xs text-muted">잘못 넣었으면 묶음째 되돌릴 수 있어요. 그때 저장한 거래만 지워요.</p>
      {message ? (
        <p role={message.error ? "alert" : "status"} className={`mt-2 text-sm ${message.error ? "text-danger" : "text-muted"}`}>
          {message.text}
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-border">
        {list.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">
                {b.fileName ?? SOURCE_LABEL[b.source]} · {b.count}건 {formatWon(b.total)}원
              </p>
              <p className="text-xs text-muted">
                {formatDateLabel(b.from)}
                {b.to !== b.from ? ` ~ ${formatDateLabel(b.to)}` : ""} · {savedAt(b.createdAt)} 저장{b.createdBy ? ` · ${b.createdBy}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => undo(b)}
              disabled={pending}
              aria-label={`${b.fileName ?? SOURCE_LABEL[b.source]} ${b.count}건 되돌리기`}
              className="h-9 shrink-0 rounded-xl border border-border px-3 text-sm font-medium text-danger hover:bg-fill disabled:opacity-50"
            >
              되돌리기
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
