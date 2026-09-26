// 연간 리포트(시트 통합시트)와 예비비 집계. docs/PLANNING.md 7장.
import type { CategoryGroup } from "./data/settings";
import type { TransactionRow } from "./data/transactions";
import type { ReserveCategory, ReserveEntry } from "./data/reserve";

/**
 * 평균을 낼 때 나누는 개월 수 (시트: 지난 해는 12, 올해는 오늘이 속한 달 번호, 앞으로의 해는 0)
 */
export function monthsElapsed(year: number, today: string): number {
  const ty = Number(today.slice(0, 4));
  if (year < ty) return 12;
  if (year > ty) return 0;
  return Number(today.slice(5, 7));
}

export const average = (total: number, months: number) => (months > 0 ? total / months : 0);

export type AnnualLine = { id: string; name: string; months: number[]; total: number };
export type AnnualGroup = { id: string; name: string; kind: CategoryGroup["kind"]; lines: AnnualLine[]; months: number[]; total: number };

const zeros = () => Array<number>(12).fill(0);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const monthIndex = (date: string) => Number(date.slice(5, 7)) - 1;

/** 대분류 > 소분류 × 1~12월. 숨긴 소분류는 값이 있을 때만. */
export function annualByCategory(rows: TransactionRow[], groups: CategoryGroup[], year: number): AnnualGroup[] {
  const byCat = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.categoryId || !r.occurredOn.startsWith(`${year}-`)) continue;
    const arr = byCat.get(r.categoryId) ?? zeros();
    arr[monthIndex(r.occurredOn)] += r.amount;
    byCat.set(r.categoryId, arr);
  }
  const result: AnnualGroup[] = [];
  for (const g of groups) {
    const lines: AnnualLine[] = [];
    for (const c of g.categories) {
      const months = byCat.get(c.id) ?? zeros();
      const total = sum(months);
      if (!c.isHidden || total > 0) lines.push({ id: c.id, name: c.name, months, total });
    }
    const months = zeros().map((_, i) => sum(lines.map((l) => l.months[i])));
    const total = sum(months);
    if (!g.isHidden || total > 0) result.push({ id: g.id, name: g.name, kind: g.kind, lines, months, total });
  }
  return result;
}

/** 예비비 지출: 분류 × 1~12월 */
export function annualReserve(entries: ReserveEntry[], categories: ReserveCategory[], year: number): AnnualLine[] {
  return categories.map((c) => {
    const months = zeros();
    for (const e of entries) {
      if (e.direction === "out" && e.categoryId === c.id && e.occurredOn.startsWith(`${year}-`)) months[monthIndex(e.occurredOn)] += e.amount;
    }
    return { id: c.id, name: c.name, months, total: sum(months) };
  });
}

export function addMonthly(...lists: number[][]): number[] {
  return zeros().map((_, i) => sum(lists.map((l) => l[i] ?? 0)));
}

export type ReserveRow = { id: string; name: string; note: string | null; deposit: number; spent: number; balance: number };

/**
 * 예비비 분류별 (시트 예비비 탭): 입금 − 지출, 음수면 0.
 * 총계는 분류별 잔액의 합이 아니라 총 입금 − 총 지출 (음수 가능).
 */
export function reserveSummary(entries: ReserveEntry[], categories: ReserveCategory[]) {
  const rows: ReserveRow[] = categories.map((c) => {
    const deposit = sum(entries.filter((e) => e.categoryId === c.id && e.direction === "in").map((e) => e.amount));
    const spent = sum(entries.filter((e) => e.categoryId === c.id && e.direction === "out").map((e) => e.amount));
    return { id: c.id, name: c.name, note: c.note, deposit, spent, balance: Math.max(deposit - spent, 0) };
  });
  const totalIn = sum(entries.filter((e) => e.direction === "in").map((e) => e.amount));
  const totalOut = sum(entries.filter((e) => e.direction === "out").map((e) => e.amount));
  return { rows, totalIn, totalOut, totalBalance: totalIn - totalOut };
}
