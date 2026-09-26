import { describe, expect, it } from "vitest";
import { dueDate, dueStatus, loanStatus, netWorthByMonth, type AssetItem } from "./finance";

const item = (id: string, section: AssetItem["section"]): AssetItem => ({ id, section, groupName: "g", name: id, sortOrder: 0, isHidden: false });

describe("netWorthByMonth", () => {
  it("순자산 = 비유동 + 유동 − 부채, 입력 없는 달은 null", () => {
    const r = netWorthByMonth(
      [item("집", "non_current"), item("예금", "current"), item("대출", "liability")],
      [
        { itemId: "집", month: "2026-01", amount: 500 },
        { itemId: "예금", month: "2026-01", amount: 100 },
        { itemId: "대출", month: "2026-01", amount: 300 },
        { itemId: "예금", month: "2026-02", amount: 120 },
      ],
      ["2026-01", "2026-02", "2026-03"],
    );
    expect(r).toEqual([
      { month: "2026-01", assets: 600, liabilities: 300, netWorth: 300 },
      { month: "2026-02", assets: 120, liabilities: 0, netWorth: 120 },
      { month: "2026-03", assets: null, liabilities: null, netWorth: null },
    ]);
  });
});

describe("loanStatus", () => {
  it("시트 대출 관리와 같은 계산", () => {
    expect(
      loanStatus(100_000_000, [
        { principal: 1_000_000, interest: 200_001 },
        { principal: 20_000, interest: 123_232 },
      ]),
    ).toEqual({ repaid: 1_020_000, balance: 98_980_000, interest: 323_233, progress: 0.0102 });
  });
});

describe("dueStatus", () => {
  it("말일 보정과 상태", () => {
    expect(dueDate(31, "2026-02")).toBe("2026-02-28");
    expect(dueStatus(25, "2026-09", "2026-09-22", false)).toEqual({ date: "2026-09-25", status: "upcoming", daysLeft: 3 });
    expect(dueStatus(22, "2026-09", "2026-09-22", false).status).toBe("today");
    expect(dueStatus(10, "2026-09", "2026-09-22", false).status).toBe("overdue");
    expect(dueStatus(10, "2026-09", "2026-09-22", true).status).toBe("entered");
  });
});
