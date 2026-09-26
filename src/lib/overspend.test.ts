import { describe, expect, it } from "vitest";
import type { TransactionRow } from "./data/transactions";
import { overspendAlerts, spendByTarget } from "./overspend";

function tx(date: string, amount: number, categoryId: string, p: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: Math.random().toString(),
    occurredOn: date,
    amount,
    memo: null,
    categoryId,
    categoryName: categoryId,
    groupId: "g",
    groupName: "g",
    groupKind: "variable_expense",
    kind: "expense",
    paymentMethodId: null,
    paymentMethodName: null,
    tags: [],
    createdBy: null,
    creatorName: null,
    ...p,
  };
}

const names = new Map([
  ["category:cafe", "식비 · 카페"],
  ["category:mart", "식비 · 마트"],
  ["tag:regret", "반성"],
]);

describe("spendByTarget", () => {
  it("지출만, 소분류·태그 각각", () => {
    const sums = spendByTarget([
      tx("2026-09-01", 100, "cafe", { tags: [{ id: "regret", name: "반성" }] }),
      tx("2026-09-02", 999, "salary", { kind: "income", groupKind: "income", tags: [{ id: "regret", name: "반성" }] }),
    ]);
    expect(sums.get("category:cafe")).toBe(100);
    expect(sums.get("tag:regret")).toBe(100);
    expect(sums.has("category:salary")).toBe(false);
  });
});

describe("overspendAlerts", () => {
  const past = [
    tx("2026-06-10", 50_000, "cafe"),
    tx("2026-07-10", 40_000, "cafe"),
    tx("2026-08-10", 60_000, "cafe"),
    tx("2026-08-11", 100_000, "mart"),
  ];

  it("한도: 80% 이상 주의, 넘으면 초과. 한도를 정한 항목은 평균 비교 안 함", () => {
    const alerts = overspendAlerts({
      rows: [tx("2026-09-01", 90_000, "cafe"), tx("2026-09-02", 30_000, "mart", { tags: [{ id: "regret", name: "반성" }] })],
      pastRows: past,
      month: "2026-09",
      limits: [
        { type: "category", id: "cafe", amount: 80_000 },
        { type: "tag", id: "regret", amount: 35_000 },
      ],
      names,
    });
    expect(alerts.map((a) => [a.name, a.kind])).toEqual([
      ["식비 · 카페", "over_limit"],
      ["반성", "near_limit"],
    ]);
  });

  it("평균(거래가 있는 달만)보다 1.3배 이상, 1만 원 이상 더 쓰면 알림", () => {
    const alerts = overspendAlerts({
      rows: [tx("2026-09-01", 80_000, "cafe"), tx("2026-09-02", 60_000, "mart")],
      pastRows: past,
      month: "2026-09",
      limits: [],
      names,
    });
    // 카페 평균 50,000 → 80,000 은 알림. 마트는 평균 33,333 (3개월 중 1개월만 썼음) → 60,000 알림
    expect(alerts).toEqual([
      { type: "category", id: "mart", name: "식비 · 마트", spent: 60_000, average: 33_333, kind: "above_average" },
      { type: "category", id: "cafe", name: "식비 · 카페", spent: 80_000, average: 50_000, kind: "above_average" },
    ]);
  });

  it("차이가 1만 원 미만이면 알리지 않음", () => {
    const alerts = overspendAlerts({
      rows: [tx("2026-09-01", 9_000, "cafe")],
      pastRows: [tx("2026-07-01", 5_000, "cafe"), tx("2026-08-01", 5_000, "cafe")],
      month: "2026-09",
      limits: [],
      names,
    });
    expect(alerts).toEqual([]);
  });

  it("지난 기록이 두 달보다 적으면 평균 비교를 하지 않음", () => {
    const alerts = overspendAlerts({
      rows: [tx("2026-09-01", 500_000, "cafe")],
      pastRows: [tx("2026-08-01", 5_000, "cafe")],
      month: "2026-09",
      limits: [],
      names,
    });
    expect(alerts).toEqual([]);
  });
});
