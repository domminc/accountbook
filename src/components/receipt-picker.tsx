"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { compressImage } from "@/lib/image";

/** 영수증 사진 고르기: 고르면 바로 줄여서 들고 있다가, 저장할 때 폼에 붙인다. */
export function ReceiptPicker({ files, onChange, max }: { files: Blob[]; onChange: (files: Blob[]) => void; max: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    setBusy(true);
    const next = [...files];
    try {
      for (const f of Array.from(list).slice(0, max - files.length)) next.push(await compressImage(f));
      if (list.length > max - files.length) setError(`영수증은 ${max}장까지예요.`);
    } catch {
      setError("사진을 읽지 못했어요. 다른 사진을 골라 주세요.");
    } finally {
      setBusy(false);
      onChange(next);
    }
  }

  return (
    <div>
      <span className="text-sm font-medium">영수증 사진</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative">
            <Image src={u} alt={`고른 영수증 ${i + 1}`} width={80} height={80} unoptimized className="size-20 rounded-lg border border-border object-cover" />
            <button
              type="button"
              aria-label={`고른 영수증 ${i + 1} 빼기`}
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute -top-2 -right-2 size-6 rounded-full border border-border bg-surface text-sm leading-none"
            >
              ×
            </button>
          </div>
        ))}
        {files.length < max ? <AddTile busy={busy} onPick={add} /> : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** "+ 사진" 칸 (휴대폰에서는 카메라·앨범 중 고른다) */
export function AddTile({ busy, onPick }: { busy: boolean; onPick: (files: FileList | null) => void }) {
  return (
    <label className="flex size-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted focus-within:border-accent">
      {busy ? "줄이는 중…" : "+ 사진"}
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        aria-label="영수증 사진 추가"
        className="sr-only"
        onChange={(e) => {
          const list = e.target.files;
          void Promise.resolve(onPick(list)).finally(() => {
            e.target.value = "";
          });
        }}
      />
    </label>
  );
}
