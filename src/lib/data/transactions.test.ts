import { describe, expect, it } from "vitest";
import { groupByDate, sumByKind, type TransactionRow } from "./transactions";

function row(p: Partial<TransactionRow>): TransactionRow {
  return {
    id: Math.random().toString(),
    occurredOn: "2026-01-01",
    amount: 0,
    memo: null,
    categoryId: null,
    categoryName: null,
    groupId: null,
    groupName: null,
    groupKind: null,
    kind: null,
    paymentMethodId: null,
    paymentMethodName: null,
    tags: [],
    createdBy: null,
    creatorName: null,
    ...p,
  };
}

describe("sumByKind", () => {
  it("유형별 합계 (고정·비고정지출은 지출)", () => {
    const totals = sumByKind([
      row({ kind: "income", amount: 3_000_000 }),
      row({ kind: "saving", amount: 500_000 }),
      row({ kind: "expense", groupKind: "fixed_expense", amount: 700_000 }),
      row({ kind: "expense", groupKind: "variable_expense", amount: 12_000 }),
      row({ kind: null, amount: 5_000 }),
    ]);
    expect(totals).toEqual({ income: 3_000_000, saving: 500_000, expense: 712_000, uncategorized: 5_000 });
  });
});

describe("groupByDate", () => {
  it("연속된 같은 날짜끼리 묶는다", () => {
    const groups = groupByDate([
      row({ occurredOn: "2026-01-03", amount: 1 }),
      row({ occurredOn: "2026-01-03", amount: 2 }),
      row({ occurredOn: "2026-01-01", amount: 3 }),
    ]);
    expect(groups.map((g) => [g.date, g.rows.length])).toEqual([
      ["2026-01-03", 2],
      ["2026-01-01", 1],
    ]);
  });
});
