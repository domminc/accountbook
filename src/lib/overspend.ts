// 과소비 알림: 소분류·태그별 이달 지출을 한도 또는 지난 3개월 평균과 비교한다. 지출(고정+비고정)만 센다.
import type { TransactionRow } from "./data/transactions";
import { addMonths } from "./month";

export type LimitTarget = { type: "category" | "tag"; id: string };
export type SpendingLimit = LimitTarget & { amount: number };

export type OverspendAlert = LimitTarget & {
  name: string;
  spent: number;
  kind: "over_limit" | "near_limit" | "above_average";
  limit?: number;
  average?: number;
};

/** 평균보다 이만큼(배) 넘게, 그리고 이 금액 이상 더 쓰면 알린다 */
export const AVERAGE_RATIO = 1.3;
export const AVERAGE_MIN_DIFF = 10_000;
/** 평균을 내려면 거래가 있는 달이 이만큼은 있어야 한다 (처음 쓰는 가계부에서 헛알림 방지) */
const MIN_HISTORY_MONTHS = 2;

const keyOf = (t: LimitTarget) => `${t.type}:${t.id}`;

/** 소분류·태그별 지출 합 */
export function spendByTarget(rows: TransactionRow[]): Map<string, number> {
  const sums = new Map<string, number>();
  const add = (k: string, v: number) => sums.set(k, (sums.get(k) ?? 0) + v);
  for (const r of rows) {
    if (r.kind !== "expense") continue;
    if (r.categoryId) add(keyOf({ type: "category", id: r.categoryId }), r.amount);
    for (const t of r.tags) add(keyOf({ type: "tag", id: t.id }), r.amount);
  }
  return sums;
}

/**
 * @param rows 이달 거래 (이번 달이면 오늘까지)
 * @param pastRows 지난 3개월 거래
 * @param names "category:<id>" / "tag:<id>" → 화면에 보일 이름
 */
export function overspendAlerts({
  rows,
  pastRows,
  month,
  limits,
  names,
}: {
  rows: TransactionRow[];
  pastRows: TransactionRow[];
  month: string;
  limits: SpendingLimit[];
  names: Map<string, string>;
}): OverspendAlert[] {
  const spent = spendByTarget(rows);
  const alerts: OverspendAlert[] = [];
  const limited = new Set<string>();

  for (const l of limits) {
    const k = keyOf(l);
    limited.add(k);
    const s = spent.get(k) ?? 0;
    const name = names.get(k);
    if (!name || l.amount <= 0) continue;
    if (s > l.amount) alerts.push({ type: l.type, id: l.id, name, spent: s, limit: l.amount, kind: "over_limit" });
    else if (s >= l.amount * 0.8) alerts.push({ type: l.type, id: l.id, name, spent: s, limit: l.amount, kind: "near_limit" });
  }

  // 지난 3개월 중 거래가 있는 달로만 평균
  const pastMonths = [1, 2, 3].map((n) => addMonths(month, -n));
  const active = pastMonths.filter((pm) => pastRows.some((r) => r.occurredOn.startsWith(pm)));
  if (active.length >= MIN_HISTORY_MONTHS) {
    const past = spendByTarget(pastRows.filter((r) => active.some((pm) => r.occurredOn.startsWith(pm))));
    for (const [k, s] of spent) {
      if (limited.has(k)) continue;
      const name = names.get(k);
      const average = Math.round((past.get(k) ?? 0) / active.length);
      if (!name || average <= 0) continue;
      if (s >= average * AVERAGE_RATIO && s - average >= AVERAGE_MIN_DIFF) {
        const [type, id] = k.split(":") as [LimitTarget["type"], string];
        alerts.push({ type, id, name, spent: s, average, kind: "above_average" });
      }
    }
  }

  const order = { over_limit: 0, near_limit: 1, above_average: 2 };
  const ratio = (a: OverspendAlert) => a.spent / (a.limit ?? a.average ?? 1);
  return alerts.sort((a, b) => order[a.kind] - order[b.kind] || ratio(b) - ratio(a));
}
