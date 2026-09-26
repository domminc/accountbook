import { describe, expect, it } from "vitest";
import { dayTone, holidaysOf } from "./holidays";

const dates = (y: number) => [...holidaysOf(y).keys()];
const subs = (y: number) => [...holidaysOf(y).entries()].filter(([, n]) => n.startsWith("대체공휴일")).map(([d]) => d);

describe("대한민국 공휴일", () => {
  it("2026년: 행정안전부 발표와 같은 22일 (제헌절 부활·노동절 신설·대체공휴일 4일)", () => {
    expect(dates(2026)).toEqual([
      "2026-01-01",
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2026-03-01",
      "2026-03-02",
      "2026-05-01",
      "2026-05-05",
      "2026-05-24",
      "2026-05-25",
      "2026-06-03",
      "2026-06-06",
      "2026-07-17",
      "2026-08-15",
      "2026-08-17",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-10-03",
      "2026-10-05",
      "2026-10-09",
      "2026-12-25",
    ]);
    expect(holidaysOf(2026).get("2026-10-05")).toBe("대체공휴일 (개천절)");
  });

  it("2025년 대체공휴일: 삼일절(토)·어린이날과 부처님오신날 겹침(한 번만)·추석(일)", () => {
    expect(subs(2025)).toEqual(["2025-03-03", "2025-05-06", "2025-10-08"]);
    expect(holidaysOf(2025).get("2025-05-05")).toBe("어린이날·부처님오신날");
    expect(holidaysOf(2025).get("2025-01-27")).toBe("임시공휴일");
    // 노동절·제헌절은 2026년부터
    expect(holidaysOf(2025).has("2025-05-01")).toBe(false);
    expect(holidaysOf(2025).has("2025-07-17")).toBe(false);
  });

  it("2027년: 설 연휴가 일요일과 겹치면 연휴 다음 평일, 토요일 휴일도 대체", () => {
    expect(subs(2027)).toEqual(["2027-02-09", "2027-05-03", "2027-07-19", "2027-08-16", "2027-10-04", "2027-10-11", "2027-12-27"]);
  });

  it("설·추석은 토요일과만 겹치면 대체공휴일 없음, 현충일은 대체 없음", () => {
    // 2026 추석 9/24~26 (목~토), 현충일 6/6 (토)
    expect(subs(2026)).not.toContain("2026-09-28");
    expect(subs(2026)).not.toContain("2026-06-08");
  });

  it("달력 색", () => {
    expect(dayTone("2026-09-27")).toBe("sunday");
    expect(dayTone("2026-09-26")).toBe("holiday"); // 추석 연휴(토)
    expect(dayTone("2026-10-10")).toBe("saturday");
    expect(dayTone("2026-10-05")).toBe("holiday");
    expect(dayTone("2026-10-06")).toBeNull();
  });
});
