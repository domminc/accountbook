// 이달의 정리 집계. 참고 시트(디어나 가계부 v9) 월별시트·캘린더 수식을 그대로 옮겼다. (docs/PLANNING.md 7장)
import type { CategoryGroup, SimpleItem } from "./data/settings";
import type { TransactionRow } from "./data/transactions";
import { daysInMonth, monthRange } from "./month";

export type MonthTotals = {
  income: number;
  saving: number;
  /** 고정지출 + 비고정지출 (예비비 제외) */
  expense: number;
  fixed: number;
  variable: number;
  /** 총 저축 ÷ 총 수입. 수입이 0이면 null */
  savingRate: number | null;
  /** 총 수입 − 총 지출 */
  remaining: number;
};

export function monthTotals(rows: TransactionRow[]): MonthTotals {
  let income = 0;
  let saving = 0;
  let fixed = 0;
  let variable = 0;
  for (const r of rows) {
    if (r.groupKind === "income") income += r.amount;
    else if (r.groupKind === "saving") saving += r.amount;
    else if (r.groupKind === "fixed_expense") fixed += r.amount;
    else if (r.groupKind === "variable_expense") variable += r.amount;
  }
  const expense = fixed + variable;
  return { income, saving, expense, fixed, variable, savingRate: income > 0 ? saving / income : null, remaining: income - expense };
}

export type NamedAmount = { id: string; name: string; amount: number };

/** 결제 수단별: 지출(고정+비고정)만, 지출방법 순서대로. 금액이 있는 것만. */
export function byPaymentMethod(rows: TransactionRow[], methods: SimpleItem[]): NamedAmount[] {
  const sums = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== "expense" || !r.paymentMethodId) continue;
    sums.set(r.paymentMethodId, (sums.get(r.paymentMethodId) ?? 0) + r.amount);
  }
  return methods.filter((m) => sums.has(m.id)).map((m) => ({ id: m.id, name: m.name, amount: sums.get(m.id)! }));
}

/** 태그별: 분류된 모든 거래(수입·저축 포함), 태그 순서대로. */
export function byTag(rows: TransactionRow[], tags: SimpleItem[]): NamedAmount[] {
  const sums = new Map<string, number>();
  for (const r of rows) {
    if (!r.kind) continue;
    for (const t of r.tags) sums.set(t.id, (sums.get(t.id) ?? 0) + r.amount);
  }
  return tags.filter((t) => sums.has(t.id)).map((t) => ({ id: t.id, name: t.name, amount: sums.get(t.id)! }));
}

/** 소분류별 합계 (목표 관리 표·주간 표에서 씀) */
export function sumByCategory(rows: TransactionRow[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const r of rows) if (r.categoryId) sums.set(r.categoryId, (sums.get(r.categoryId) ?? 0) + r.amount);
  return sums;
}

export function sumByGroup(rows: TransactionRow[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const r of rows) if (r.groupId) sums.set(r.groupId, (sums.get(r.groupId) ?? 0) + r.amount);
  return sums;
}

export type ShareItem = { name: string; amount: number; ratio: number; other: boolean };

/**
 * 저축·지출 비중. 분모 = 총 지출 + 총 저축.
 * 저축·고정지출·비고정지출 대분류를 금액 순으로, 비율이 threshold(2%) 이하인 것은 "그 외"로 합친다.
 */
export function spendingShare(rows: TransactionRow[], groups: CategoryGroup[], threshold = 0.02): ShareItem[] {
  const byGroup = sumByGroup(rows);
  const items = groups
    .filter((g) => g.kind !== "income")
    .map((g) => ({ name: g.name, amount: byGroup.get(g.id) ?? 0 }))
    .filter((g) => g.amount > 0);
  const total = items.reduce((s, g) => s + g.amount, 0);
  if (total === 0) return [];

  const sorted = items.sort((a, b) => b.amount - a.amount);
  const kept: ShareItem[] = [];
  let otherAmount = 0;
  for (const g of sorted) {
    const ratio = g.amount / total;
    if (ratio > threshold) kept.push({ ...g, ratio, other: false });
    else otherAmount += g.amount;
  }
  if (otherAmount > 0) kept.push({ name: "그 외", amount: otherAmount, ratio: otherAmount / total, other: true });
  return kept;
}

export type BudgetRow = {
  groupId: string;
  name: string;
  kind: "fixed_expense" | "variable_expense";
  budget: number | null;
  spent: number;
};

/** 고정지출·비고정지출 대분류별 예산 대비 실적. 숨긴 대분류는 예산이나 지출이 있을 때만. */
export function budgetRows(rows: TransactionRow[], groups: CategoryGroup[], budgets: Map<string, number>): BudgetRow[] {
  const spent = sumByGroup(rows);
  return groups
    .filter((g): g is CategoryGroup & { kind: BudgetRow["kind"] } => g.kind === "fixed_expense" || g.kind === "variable_expense")
    .filter((g) => !g.isHidden || budgets.has(g.id) || spent.has(g.id))
    .map((g) => ({ groupId: g.id, name: g.name, kind: g.kind, budget: budgets.get(g.id) ?? null, spent: spent.get(g.id) ?? 0 }));
}

// ─── 달력 · 주간 ───────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 월요일 시작 달력의 주 목록. 1주차 = 1일이 들어 있는 주 (시트 K7:Q12).
 * 달 밖의 날짜는 null.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const days = daysInMonth(y, m);
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // 월=0 … 일=6
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type DayCell = {
  date: string;
  income: number;
  saving: number;
  fixed: number;
  variable: number;
  reserve: number;
  /** 오늘까지의 날 중 비고정지출이 없는 날 */
  noSpend: boolean;
};

/** 시트 캘린더 탭: 날짜마다 수입·저축·고정·비고정·예비비 */
export function dailyCells(
  rows: TransactionRow[],
  reserveOut: { occurredOn: string; amount: number }[],
  month: string,
  today: string,
): Map<string, DayCell> {
  const { start, end } = monthRange(month);
  const cells = new Map<string, DayCell>();
  for (const week of monthWeeks(month)) {
    for (const date of week) {
      if (date) cells.set(date, { date, income: 0, saving: 0, fixed: 0, variable: 0, reserve: 0, noSpend: false });
    }
  }
  for (const r of rows) {
    const c = cells.get(r.occurredOn);
    if (!c) continue;
    if (r.groupKind === "income") c.income += r.amount;
    else if (r.groupKind === "saving") c.saving += r.amount;
    else if (r.groupKind === "fixed_expense") c.fixed += r.amount;
    else if (r.groupKind === "variable_expense") c.variable += r.amount;
  }
  for (const e of reserveOut) {
    if (e.occurredOn < start || e.occurredOn > end) continue;
    const c = cells.get(e.occurredOn);
    if (c) c.reserve += e.amount;
  }
  for (const c of cells.values()) c.noSpend = c.date <= today && c.variable === 0;
  return cells;
}

/** 캘린더 상단: 월 지출은 고정 + 비고정 + 예비비 (이달의 정리 총 지출과 다름) */
export function calendarTotals(cells: Map<string, DayCell>) {
  let income = 0;
  let saving = 0;
  let expense = 0;
  let noSpendDays = 0;
  for (const c of cells.values()) {
    income += c.income;
    saving += c.saving;
    expense += c.fixed + c.variable + c.reserve;
    if (c.noSpend) noSpendDays += 1;
  }
  return { income, saving, expense, noSpendDays };
}

/** 주간별 표: 소분류 id → 주차별 합계 (주 수 = monthWeeks 길이) */
export function weeklyByCategory(rows: TransactionRow[], month: string): Map<string, number[]> {
  const weeks = monthWeeks(month);
  const weekOf = new Map<string, number>();
  weeks.forEach((w, i) => w.forEach((d) => d && weekOf.set(d, i)));
  const result = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.categoryId) continue;
    const w = weekOf.get(r.occurredOn);
    if (w === undefined) continue;
    const arr = result.get(r.categoryId) ?? Array<number>(weeks.length).fill(0);
    arr[w] += r.amount;
    result.set(r.categoryId, arr);
  }
  return result;
}
