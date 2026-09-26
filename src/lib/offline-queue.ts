// 오프라인일 때 입력한 새 거래를 이 기기(localStorage)에 모아 두는 대기열. 브라우저에서만 쓴다.
// 로그인한 사람별로 따로 두고, 연결되면 OfflineSync 가 서버로 올린다.

export type QueuedTransaction = {
  /** 서버에 저장할 거래 id (같은 거래를 두 번 올려도 한 번만 저장) */
  clientId: string;
  userId: string;
  /** 폼 값 그대로 */
  entries: [string, string][];
  /** 화면에 보여줄 요약 */
  label: string;
  queuedAt: number;
  /** 서버가 거절한 이유 (다시 올리지 않고 사용자에게 보여준다) */
  error?: string;
};

const KEY = "ab_offline_tx";
const EVENT = "ab-offline-queue";

function readAll(): QueuedTransaction[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as QueuedTransaction[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: QueuedTransaction[]): boolean {
  try {
    if (list.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENT));
  return true;
}

export function queuedFor(userId: string): QueuedTransaction[] {
  return readAll().filter((q) => q.userId === userId);
}

/** useSyncExternalStore 용: 저장된 문자열 그대로 (바뀌지 않으면 같은 값) */
export function queueSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseQueue(snapshot: string, userId: string): QueuedTransaction[] {
  try {
    const list: unknown = snapshot ? JSON.parse(snapshot) : [];
    return Array.isArray(list) ? (list as QueuedTransaction[]).filter((q) => q.userId === userId) : [];
  } catch {
    return [];
  }
}

/** 저장하지 못하면(사생활 보호 모드 등) false */
export function enqueue(item: QueuedTransaction): boolean {
  return writeAll([...readAll().filter((q) => q.clientId !== item.clientId), item]);
}

export function removeQueued(clientId: string) {
  writeAll(readAll().filter((q) => q.clientId !== clientId));
}

export function markQueued(clientId: string, error: string | undefined) {
  writeAll(readAll().map((q) => (q.clientId === clientId ? { ...q, error } : q)));
}

/** 대기열이 바뀔 때 (다른 탭 포함) */
export function subscribeQueue(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** 서버 액션 호출이 네트워크 때문에 실패했는지 */
export function isNetworkError(e: unknown): boolean {
  return (typeof navigator !== "undefined" && navigator.onLine === false) || e instanceof TypeError;
}
