"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { syncOfflineTransaction } from "@/app/(app)/transactions/actions";
import { markQueued, parseQueue, queueSnapshot, queuedFor, removeQueued, subscribeQueue } from "@/lib/offline-queue";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * 오프라인 입력 지원: 서비스 워커 등록, 연결 상태 안내, 기기에 모아 둔 거래를 연결되면 서버로 올린다.
 */
export function OfflineSync({ userId }: { userId: string }) {
  const router = useRouter();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const snapshot = useSyncExternalStore(subscribeQueue, queueSnapshot, () => "");
  const queue = useMemo(() => parseQueue(snapshot, userId), [snapshot, userId]);
  const [busy, setBusy] = useState(false);
  const syncing = useRef(false);

  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    setBusy(true);
    let saved = false;
    try {
      for (const q of queuedFor(userId)) {
        if (q.error) continue;
        let r: Awaited<ReturnType<typeof syncOfflineTransaction>>;
        try {
          r = await syncOfflineTransaction(q.entries);
        } catch {
          break; // 아직 연결이 불안정하면 다음 기회에
        }
        if ("ok" in r) {
          removeQueued(q.clientId);
          saved = true;
        } else {
          markQueued(q.clientId, r.error);
        }
      }
    } finally {
      syncing.current = false;
      setBusy(false);
    }
    if (saved) router.refresh();
  }, [userId, router]);

  useEffect(() => {
    void sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [sync]);

  // 서비스 워커: 입력 화면을 미리 받아 두어 오프라인에서도 열리게 한다 (개발 서버에서는 쓰지 않는다)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        if (navigator.onLine) reg.active?.postMessage({ type: "warm" });
      })
      .catch(() => {});
  }, []);

  const pending = queue.filter((q) => !q.error);
  const failed = queue.filter((q) => q.error);
  if (online && queue.length === 0) return null;

  return (
    <div aria-live="polite" className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      {!online ? <p className="font-medium">인터넷 연결이 없어요. 새 거래는 이 기기에 저장했다가 연결되면 올려요.</p> : null}
      {pending.length > 0 ? (
        <p className={online ? "" : "mt-1 text-muted"}>
          기기에 저장된 거래 {pending.length}건 · {online ? (busy ? "올리는 중…" : "곧 올려요") : "연결되면 자동으로 올려요"}
        </p>
      ) : null}
      {failed.length > 0 ? (
        <div className="mt-1">
          <p className="text-danger">올리지 못한 거래 {failed.length}건</p>
          <ul className="mt-1 flex flex-col gap-2">
            {failed.map((q) => (
              <li key={q.clientId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1">
                  {q.label}
                  <span className="block text-xs text-danger">{q.error}</span>
                </span>
                <button
                  type="button"
                  className="text-accent underline underline-offset-4"
                  onClick={() => {
                    markQueued(q.clientId, undefined);
                    void sync();
                  }}
                >
                  다시 시도
                </button>
                <button
                  type="button"
                  className="text-danger underline underline-offset-4"
                  onClick={() => {
                    if (window.confirm("이 거래를 지울까요? 서버에는 올라가지 않아요.")) removeQueued(q.clientId);
                  }}
                >
                  지우기
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
