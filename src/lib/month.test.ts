import { describe, expect, it } from "vitest";
import {
  addMonths,
  formatDateLabel,
  isValidDate,
  monthRange,
  parseMonth,
  shiftDateToMonth,
  todayKST,
} from "./month";

describe("month", () => {
  it("한국 시간 기준 오늘", () => {
    // UTC 2026-01-31 15:30 = KST 2026-02-01 00:30
    expect(todayKST(new Date("2026-01-31T15:30:00Z"))).toBe("2026-02-01");
    expect(todayKST(new Date("2026-01-31T14:59:00Z"))).toBe("2026-01-31");
  });

  it("월 기간은 1일부터 말일까지", () => {
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(monthRange("2025-12")).toEqual({ start: "2025-12-01", end: "2025-12-31" });
  });

  it("월 이동은 연도를 넘긴다", () => {
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-03", -14)).toBe("2025-01");
  });

  it("잘못된 월은 이번 달로", () => {
    const now = new Date("2026-04-10T00:00:00Z");
    expect(parseMonth("2026-13", now)).toBe("2026-04");
    expect(parseMonth(undefined, now)).toBe("2026-04");
    expect(parseMonth("2025-11", now)).toBe("2025-11");
  });

  it("날짜 검사", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-2-1")).toBe(false);
  });

  it("다른 달로 옮길 때 없는 날은 말일로", () => {
    expect(shiftDateToMonth("2026-01-31", "2026-02")).toBe("2026-02-28");
    expect(shiftDateToMonth("2026-01-15", "2026-02")).toBe("2026-02-15");
  });

  it("날짜 표시", () => {
    expect(formatDateLabel("2026-01-05")).toBe("1월 5일 (월)");
  });
});
