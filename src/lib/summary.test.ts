import { describe, expect, it } from "vitest";
import type { CategoryGroup, CategoryKind, SimpleItem } from "./data/settings";
import type { TransactionRow } from "./data/transactions";
import {
  budgetRows,
  byPaymentMethod,
  byTag,
  calendarTotals,
  cardUsage,
  dailyCells,
  monthTotals,
  monthWeeks,
  spendingShare,
  weeklyByCategory,
} from "./summary";

const KIND: Record<CategoryKind, TransactionRow["kind"]> = {
  income: "income",
  saving: "saving",
  fixed_expense: "expense",
  variable_expense: "expense",
};

function tx(date: string, groupId: string, groupKind: CategoryKind, amount: number, p: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: Math.random().toString(),
    occurredOn: date,
    amount,
    memo: null,
    categoryId: `${groupId}-c`,
    categoryName: "c",
    groupId,
    groupName: groupId,
    groupKind,
    kind: KIND[groupKind],
    paymentMethodId: null,
    paymentMethodName: null,
    tags: [],
    createdBy: null,
    creatorName: null,
    ...p,
  };
}

const group = (id: string, kind: CategoryKind, isHidden = false): CategoryGroup => ({
  id,
  name: id,
  kind,
  sortOrder: 0,
  isHidden,
  categories: [{ id: `${id}-c`, name: "c", sortOrder: 0, isHidden: false }],
});
const item = (id: string): SimpleItem => ({ id, name: id, sortOrder: 0, isHidden: false });

describe("monthTotals", () => {
  it("시트 C9~C12: 수입·지출(고정+비고정)·저축·저축률", () => {
    const t = monthTotals([
      tx("2026-01-10", "수입", "income", 4_000_000),
      tx("2026-01-10", "저축", "saving", 1_000_000),
      tx("2026-01-05", "고정지출", "fixed_expense", 700_000),
      tx("2026-01-06", "식비", "variable_expense", 300_000),
      { ...tx("2026-01-06", "x", "variable_expense", 5_000), groupKind: null, kind: null }, // 미분류는 제외
    ]);
    expect(t).toEqual({
      income: 4_000_000,
      saving: 1_000_000,
      expense: 1_000_000,
      fixed: 700_000,
      variable: 300_000,
      savingRate: 0.25,
      remaining: 3_000_000,
    });
  });

  it("수입이 없으면 저축률 없음", () => {
    expect(monthTotals([tx("2026-01-01", "저축", "saving", 1)]).savingRate).toBeNull();
  });
});

describe("byPaymentMethod / byTag", () => {
  const rows = [
    tx("2026-01-01", "식비", "variable_expense", 100, { paymentMethodId: "card", tags: [{ id: "t1", name: "t1" }] }),
    tx("2026-01-01", "고정지출", "fixed_expense", 50, { paymentMethodId: "card" }),
    tx("2026-01-01", "식비", "variable_expense", 30, { paymentMethodId: "cash", tags: [{ id: "t1", name: "t1" }] }),
    tx("2026-01-01", "수입", "income", 999, { paymentMethodId: "card", tags: [{ id: "t2", name: "t2" }] }),
  ];

  it("결제 수단별은 지출만 (고정지출 포함, 수입 제외)", () => {
    expect(byPaymentMethod(rows, [item("cash"), item("card"), item("unused")])).toEqual([
      { id: "cash", name: "cash", amount: 30 },
      { id: "card", name: "card", amount: 150 },
    ]);
  });

  it("카드 사용액은 연결한 지출방법의 지출 합 (연결 없는 카드는 빠짐)", () => {
    const cards = [
      { id: "c1", name: "생활비카드", budget: 200, paymentMethodId: "card" },
      { id: "c2", name: "안쓰는카드", budget: null, paymentMethodId: "other" },
      { id: "c3", name: "연결안함", budget: 100, paymentMethodId: null },
    ];
    expect(cardUsage(cards, rows)).toEqual([
      { id: "c1", name: "생활비카드", budget: 200, spent: 150 },
      { id: "c2", name: "안쓰는카드", budget: null, spent: 0 },
    ]);
  });

  it("태그별은 수입 포함 모든 유형", () => {
    expect(byTag(rows, [item("t1"), item("t2")])).toEqual([
      { id: "t1", name: "t1", amount: 130 },
      { id: "t2", name: "t2", amount: 999 },
    ]);
  });
});

describe("spendingShare", () => {
  it("분모는 지출+저축, 2% 이하는 그 외로 합친다", () => {
    const groups = [group("수입", "income"), group("저축", "saving"), group("고정지출", "fixed_expense"), group("식비", "variable_expense"), group("건강", "variable_expense"), group("경조사", "variable_expense")];
    const share = spendingShare(
      [
        tx("2026-01-01", "수입", "income", 10_000),
        tx("2026-01-01", "저축", "saving", 300),
        tx("2026-01-01", "고정지출", "fixed_expense", 500),
        tx("2026-01-01", "식비", "variable_expense", 160),
        tx("2026-01-01", "건강", "variable_expense", 20), // 2% → 그 외
        tx("2026-01-01", "경조사", "variable_expense", 20), // 2% → 그 외
      ],
      groups,
    );
    expect(share.map((s) => [s.name, s.amount, s.ratio])).toEqual([
      ["고정지출", 500, 0.5],
      ["저축", 300, 0.3],
      ["식비", 160, 0.16],
      ["그 외", 40, 0.04],
    ]);
  });
});

describe("budgetRows", () => {
  it("고정·비고정 대분류, 숨긴 대분류는 예산·지출이 있을 때만", () => {
    const rows = budgetRows(
      [tx("2026-01-01", "식비", "variable_expense", 100)],
      [group("수입", "income"), group("고정지출", "fixed_expense"), group("식비", "variable_expense"), group("숨김", "variable_expense", true)],
      new Map([["고정지출", 1000]]),
    );
    expect(rows.map((r) => [r.name, r.budget, r.spent])).toEqual([
      ["고정지출", 1000, 0],
      ["식비", null, 100],
    ]);
  });
});

describe("monthWeeks", () => {
  it("월요일 시작, 1주차는 1일이 있는 주", () => {
    // 2026-01-01 은 목요일
    const weeks = monthWeeks("2026-01");
    expect(weeks[0]).toEqual([null, null, null, "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    expect(weeks).toHaveLength(5);
    expect(weeks[4]).toEqual(["2026-01-26", "2026-01-27", "2026-01-28", "2026-01-29", "2026-01-30", "2026-01-31", null]);
  });

  it("6주가 되는 달", () => {
    // 2026-03-01 은 일요일 → 1주차는 하루
    expect(monthWeeks("2026-03")).toHaveLength(6);
  });
});

describe("dailyCells / calendarTotals", () => {
  it("캘린더 월 지출은 예비비 포함, 무지출은 오늘까지 비고정지출 없는 날", () => {
    const cells = dailyCells(
      [
        tx("2026-01-02", "식비", "variable_expense", 100),
        tx("2026-01-03", "고정지출", "fixed_expense", 50), // 고정지출만 있는 날도 무지출
        tx("2026-01-03", "수입", "income", 1000),
      ],
      [{ occurredOn: "2026-01-03", amount: 7 }, { occurredOn: "2025-12-31", amount: 999 }],
      "2026-01",
      "2026-01-04",
    );
    expect(cells.get("2026-01-02")?.noSpend).toBe(false);
    expect(cells.get("2026-01-03")).toMatchObject({ fixed: 50, income: 1000, reserve: 7, noSpend: true });
    expect(cells.get("2026-01-05")?.noSpend).toBe(false); // 미래
    expect(calendarTotals(cells)).toEqual({ income: 1000, saving: 0, expense: 157, noSpendDays: 3 });
  });
});

describe("weeklyByCategory", () => {
  it("주차별로 나눈다", () => {
    const w = weeklyByCategory(
      [tx("2026-01-01", "식비", "variable_expense", 10), tx("2026-01-05", "식비", "variable_expense", 20), tx("2026-01-31", "식비", "variable_expense", 5)],
      "2026-01",
    );
    expect(w.get("식비-c")).toEqual([10, 20, 0, 0, 5]);
  });
});
