import { describe, expect, it } from "vitest";
import type { CategoryGroup } from "./data/settings";
import type { TransactionRow } from "./data/transactions";
import type { ReserveCategory, ReserveEntry } from "./data/reserve";
import { annualByCategory, annualReserve, average, monthsElapsed, reserveSummary } from "./annual";

describe("monthsElapsed", () => {
  it("지난 해 12, 올해는 이번 달 번호, 앞으로의 해 0", () => {
    expect(monthsElapsed(2025, "2026-09-26")).toBe(12);
    expect(monthsElapsed(2026, "2026-09-26")).toBe(9);
    expect(monthsElapsed(2027, "2026-09-26")).toBe(0);
    expect(average(900, 9)).toBe(100);
    expect(average(900, 0)).toBe(0);
  });
});

const tx = (date: string, categoryId: string, amount: number) => ({ occurredOn: date, categoryId, amount }) as TransactionRow;
const group = (id: string, cats: [string, boolean][], isHidden = false): CategoryGroup => ({
  id,
  name: id,
  kind: "variable_expense",
  sortOrder: 0,
  isHidden,
  categories: cats.map(([cid, hidden]) => ({ id: cid, name: cid, sortOrder: 0, isHidden: hidden })),
});

describe("annualByCategory", () => {
  it("소분류 × 월, 대분류 합계. 다른 해 거래는 빼고, 숨긴 항목은 값이 있을 때만", () => {
    const result = annualByCategory(
      [tx("2026-01-05", "마트", 100), tx("2026-01-20", "마트", 50), tx("2026-03-01", "외식", 30), tx("2025-12-31", "마트", 999), tx("2026-02-01", "숨김있음", 7)],
      [group("식비", [["마트", false], ["외식", false], ["숨김없음", true], ["숨김있음", true]]), group("숨긴대분류", [["x", false]], true)],
      2026,
    );
    expect(result).toHaveLength(1);
    expect(result[0].lines.map((l) => [l.name, l.total])).toEqual([
      ["마트", 150],
      ["외식", 30],
      ["숨김있음", 7],
    ]);
    expect(result[0].months.slice(0, 3)).toEqual([150, 7, 30]);
    expect(result[0].total).toBe(187);
  });
});

const cat = (id: string): ReserveCategory => ({ id, name: id, note: null, sortOrder: 0 });
const entry = (direction: "in" | "out", categoryId: string, amount: number, occurredOn = "2026-01-10") =>
  ({ id: Math.random().toString(), direction, categoryId, amount, occurredOn, categoryName: categoryId, memo: null, note: null }) as ReserveEntry;

describe("reserve", () => {
  it("분류별 잔액은 음수면 0, 총 잔액은 음수 가능 (시트와 같음)", () => {
    const s = reserveSummary([entry("in", "생활비", 1000), entry("out", "생활비", 300), entry("out", "투자", 500)], [cat("생활비"), cat("투자")]);
    expect(s.rows.map((r) => [r.name, r.deposit, r.spent, r.balance])).toEqual([
      ["생활비", 1000, 300, 700],
      ["투자", 0, 500, 0],
    ]);
    expect(s).toMatchObject({ totalIn: 1000, totalOut: 800, totalBalance: 200 });
    expect(reserveSummary([entry("out", "투자", 500)], [cat("투자")]).totalBalance).toBe(-500);
  });

  it("연간 예비비 지출은 분류 × 월", () => {
    const lines = annualReserve([entry("out", "투자", 500, "2026-02-01"), entry("in", "투자", 999, "2026-02-01")], [cat("투자")], 2026);
    expect(lines[0].months[1]).toBe(500);
    expect(lines[0].total).toBe(500);
  });
});
