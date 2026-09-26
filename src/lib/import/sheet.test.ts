import { describe, expect, it } from "vitest";
import { applyCutoff, parseWorkbook, previewByMonth, toDate, type Cell, type SheetInput } from "./sheet";

/** 행·열 번호(0부터)로 셀을 채운 시트 */
function sheet(name: string, cells: [row: number, col: number, value: Cell][]): SheetInput {
  const data: Cell[][] = [];
  for (const [r, c, v] of cells) {
    data[r] ??= [];
    data[r][c] = v;
  }
  for (let i = 0; i < data.length; i++) data[i] ??= [];
  return { sheet: name, data };
}

const d = (s: string) => new Date(`${s}T00:00:00Z`);

// 열: B=1 C=2 E=4 H=7 I=8 J=9 K=10 L=11 M=12 N=13 O=14 S=18 T=19 U=20 V=21 W=22 X=23 Y=24 Z=25
const settings = sheet("설정", [
  [1, 2, "체크카드"],
  [1, 3, "현금"],
  [2, 2, 2026],
  [2, 4, 11], // 시작 월 11 → 1번 시트 = 2026-11, 3번 시트 = 2027-01
  [2, 6, 1],
  [5, 1, "수입"],
  [5, 2, "월급"],
  [6, 1, "저축"],
  [6, 2, "적금"],
  [7, 1, "고정지출"],
  [7, 2, "통신비"],
  [8, 1, "식비"],
  [8, 2, "마트"],
  [8, 3, "외식"],
]);

const month1 = sheet("1", [
  [14, 4, "반성"],
  [14, 7, "날짜"],
  [14, 8, "예산"],
  [14, 9, "내용"],
  [15, 7, d("2026-11-20")],
  [15, 8, 200000],
  [15, 9, "생일"],
  [16, 8, 124049], // 날짜 없는 메모 행은 무시
  [16, 9, "이월"],
  // 고정지출 표
  [5, 18, "No"],
  [5, 19, "* 날짜"],
  [6, 18, 1],
  [6, 19, d("2026-11-05")],
  [6, 21, 55000],
  [6, 22, "고정지출"],
  [6, 23, "통신비"],
  [6, 24, "체크카드"],
  // 수입·저축·지출 표
  [28, 18, "No"],
  [28, 19, "* 날짜"],
  [29, 19, d("2026-11-10")],
  [29, 20, "급여"],
  [29, 21, 3000000],
  [29, 22, "수입"],
  [29, 23, "월급"],
  [30, 19, 46335], // 엑셀 일련번호 = 2026-11-09
  [30, 21, "12,000"],
  [30, 22, "식비"],
  [30, 23, "간식"], // 설정에 없는 소분류 → 추가
  [30, 24, "카드"], // 설정에 없는 지출방법 → 추가
  [30, 25, "과소비"],
  [31, 19, d("2026-11-11")],
  [31, 21, 7000], // 분류 없음 → 미분류
  [32, 19, d("2026-11-12")], // 금액 없음 → 무시
  // 목표 관리
  [34, 1, "목표 관리 (자동 계산 / [목표]는 직접 입력)"],
  [36, 1, "수입"],
  [36, 2, 5000000],
  [36, 9, "부수입 늘리기"],
  [43, 1, "지출"],
  [43, 2, 2000000],
  // 주간별 표
  [54, 1, "주간별 고정지출 내역 정리"],
  [55, 1, "대분류"],
  [56, 1, "고정지출"],
  [56, 2, 100000],
  [64, 1, "고정지출 합계"],
  [64, 2, 999],
  [67, 1, "주간별 비고정지출 내역 정리"],
  [69, 1, "식비"],
  [69, 2, 300000],
  [120, 1, "총 예산"],
  [120, 2, 300000],
]);

const month3 = sheet("3", [
  [5, 18, "No"],
  [5, 19, "* 날짜"],
  [6, 19, d("2027-01-03")],
  [6, 21, 8000],
  [6, 22, "식비"],
  [6, 23, "외식"],
]);

const reserve = sheet("예비비", [
  [8, 1, "* 분류"],
  [8, 9, "No"],
  [8, 10, "* 날짜"],
  [9, 1, "생활비"],
  [9, 5, "메모"],
  [10, 1, "경조사"],
  [9, 10, d("2026-11-15")],
  [9, 11, "엄마"],
  [9, 12, 200000],
  [9, 13, "경조사"],
  [9, 14, "비고"],
  [24, 1, "날짜"],
  [24, 2, "* 입금 금액 (or 예산)"],
  [25, 1, d("2026-10-30")],
  [25, 2, 2000000],
  [25, 3, "생활비"],
  [25, 4, "급여"],
]);

describe("parseWorkbook", () => {
  const data = parseWorkbook([settings, month1, month3, reserve]);

  it("설정: 연도·대분류·소분류·지출방법, 거래에만 있는 항목도 추가", () => {
    expect(data.year).toBe(2026);
    expect(data.groups).toEqual([
      { name: "수입", kind: "income", categories: ["월급"] },
      { name: "저축", kind: "saving", categories: ["적금"] },
      { name: "고정지출", kind: "fixed_expense", categories: ["통신비"] },
      { name: "식비", kind: "variable_expense", categories: ["마트", "외식", "간식"] },
    ]);
    expect(data.paymentMethods).toEqual(["체크카드", "현금", "카드"]);
    expect(data.tags).toEqual(["반성", "과소비"]);
  });

  it("거래: 두 표 모두 읽고, 분류 없는 행은 미분류, 금액 없는 행은 무시", () => {
    expect(data.transactions).toEqual([
      { date: "2026-11-05", amount: 55000, memo: null, group: "고정지출", category: "통신비", paymentMethod: "체크카드", tag: null },
      { date: "2026-11-10", amount: 3000000, memo: "급여", group: "수입", category: "월급", paymentMethod: null, tag: null },
      { date: "2026-11-09", amount: 12000, memo: null, group: "식비", category: "간식", paymentMethod: "카드", tag: "과소비" },
      { date: "2026-11-11", amount: 7000, memo: null, group: null, category: null, paymentMethod: null, tag: null },
      { date: "2027-01-03", amount: 8000, memo: null, group: "식비", category: "외식", paymentMethod: null, tag: null },
    ]);
  });

  it("목표·예산·이벤트는 표 제목으로 찾는다 (시작 월이 11월이면 3번 시트는 다음 해 1월)", () => {
    expect(data.goals).toEqual([
      { month: "2026-11", kind: "income", amount: 5000000, note: "부수입 늘리기" },
      { month: "2026-11", kind: "expense", amount: 2000000, note: null },
    ]);
    expect(data.budgets).toEqual([
      { month: "2026-11", group: "고정지출", amount: 100000 },
      { month: "2026-11", group: "식비", amount: 300000 },
    ]);
    expect(data.events).toEqual([{ date: "2026-11-20", budget: 200000, content: "생일" }]);
  });

  it("예비비: 분류·입금·지출", () => {
    expect(data.reserve.categories).toEqual([
      { name: "생활비", note: "메모" },
      { name: "경조사", note: null },
    ]);
    expect(data.reserve.ins).toEqual([{ date: "2026-10-30", amount: 2000000, category: "생활비", memo: "급여" }]);
    expect(data.reserve.outs).toEqual([{ date: "2026-11-15", amount: 200000, category: "경조사", memo: "엄마", note: "비고" }]);
  });

  it("시작 날짜 이전은 뺀다", () => {
    const { data: cut, skipped } = applyCutoff(data, "2026-11-06");
    expect(cut.transactions.map((t) => t.date)).toEqual(["2026-11-10", "2026-11-09", "2026-11-11", "2027-01-03"]);
    expect(cut.reserve.ins).toEqual([]);
    expect(skipped).toBe(2);
  });

  it("미리보기 월별 합계는 시트 규칙과 같다", () => {
    expect(previewByMonth(data)).toEqual([
      { month: "2026-11", count: 4, income: 3000000, saving: 0, expense: 67000, uncategorized: 1 },
      { month: "2027-01", count: 1, income: 0, saving: 0, expense: 8000, uncategorized: 0 },
    ]);
  });

  it("설정 탭이 없으면 오류", () => {
    expect(() => parseWorkbook([month1])).toThrow("설정");
  });
});

describe("toDate", () => {
  it("여러 형식", () => {
    expect(toDate(d("2026-01-05"))).toBe("2026-01-05");
    expect(toDate(46027)).toBe("2026-01-05");
    expect(toDate("2026. 1. 5")).toBe("2026-01-05");
    expect(toDate("abc")).toBeNull();
  });
});
