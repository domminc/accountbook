"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { compressImage } from "@/lib/image";
import { RECEIPTS_PER_TRANSACTION } from "@/lib/receipt";
import { AddTile } from "@/components/receipt-picker";
import { addReceipts, deleteReceipt } from "./receipt-actions";

/** 거래 수정 화면의 영수증: 보기·추가·삭제 */
export function ReceiptManager({ transactionId, receiptIds }: { transactionId: string; receiptIds: string[] }) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    setBusy(true);
    const fd = new FormData();
    try {
      for (const f of Array.from(list).slice(0, RECEIPTS_PER_TRANSACTION - receiptIds.length)) {
        fd.append("receipt", await compressImage(f), "receipt.jpg");
      }
    } catch {
      setBusy(false);
      setError("사진을 읽지 못했어요. 다른 사진을 골라 주세요.");
      return;
    }
    setBusy(false);
    startTransition(async () => {
      const r = await addReceipts(transactionId, {}, fd);
      if (r.error) setError(r.error);
    });
  }

  return (
    <section className="mt-6 border-t border-border pt-6">
      <h2 className="text-sm font-medium">영수증 사진</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {receiptIds.map((id, i) => (
          <div key={id} className="relative">
            <a href={`/receipts/${id}`} target="_blank" rel="noopener">
              <Image
                src={`/receipts/${id}`}
                alt={`영수증 ${i + 1}`}
                width={80}
                height={80}
                unoptimized
                className="size-20 rounded-lg border border-border object-cover"
              />
            </a>
            <button
              type="button"
              aria-label={`영수증 ${i + 1} 삭제`}
              disabled={pending}
              onClick={() => {
                if (!window.confirm("이 영수증 사진을 지울까요?")) return;
                startTransition(async () => {
                  const r = await deleteReceipt(id);
                  if (r.error) setError(r.error);
                });
              }}
              className="absolute -top-2 -right-2 size-6 rounded-full border border-border bg-surface text-sm leading-none text-danger"
            >
              ×
            </button>
          </div>
        ))}
        {receiptIds.length < RECEIPTS_PER_TRANSACTION ? <AddTile busy={busy || pending} onPick={add} /> : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
