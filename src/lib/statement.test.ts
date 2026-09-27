import { describe, expect, it } from "vitest";
import { findColumns, parseAmountText, parseDateText, parseStatement } from "./statement";

const TODAY = "2026-09-27";

describe("parseDateText", () => {
  it.each([
    ["2026.09.01", "2026-09-01", null],
    ["2026-09-01 12:34:56", "2026-09-01", "12:34"],
    ["2026/9/1", "2026-09-01", null],
    ["26.09.01", "2026-09-01", null],
    ["20260901", "2026-09-01", null],
    ["2026년 9월 1일", "2026-09-01", null],
    ["09.01 08:05", "2026-09-01", "08:05"],
    ["12/30", "2025-12-30", null], // 오늘보다 뒤 → 작년
  ])("%s", (text, date, time) => {
    expect(parseDateText(text, TODAY)).toMatchObject({ date, time });
  });

  it("날짜가 아니면 null", () => {
    expect(parseDateText("스타벅스", TODAY)).toBeNull();
    expect(parseDateText("2026.13.01", TODAY)).toBeNull();
  });
});

describe("parseAmountText", () => {
  it.each([
    ["12,500", 12500],
    ["12,500원", 12500],
    ["₩ 3,000", 3000],
    ["-12,500", -12500],
    ["(12,500)", -12500],
    ["4500", 4500],
    ["", null],
    ["일시불", null],
  ])("%s", (text, n) => {
    expect(parseAmountText(text)).toBe(n);
  });
});

describe("findColumns", () => {
  it("이용금액을 해외·수수료·결제후잔액보다 먼저 고른다", () => {
    const c = findColumns(["이용일자", "이용가맹점(은행)명", "해외이용금액", "이용금액", "할부개월", "수수료", "결제후잔액"]);
    expect(c).toMatchObject({ date: 0, merchant: 1, amount: 3, installment: 4 });
  });

  it("결제일은 이용일로 보지 않는다", () => {
    expect(findColumns(["결제예정일", "가맹점명", "금액"])).toBeNull();
  });
});

describe("parseStatement: 표 파일", () => {
  it("신한 이용내역 모양 (제목 줄, 머리글, 취소, 합계)", () => {
    const rows = [
      ["신한카드 국내 이용내역 조회"],
      ["조회기간 : 2026.09.01 ~ 2026.09.27"],
      [],
      ["이용일자", "이용시간", "이용카드", "이용가맹점", "이용금액", "이용구분", "승인번호", "취소상태"],
      ["2026.09.01", "12:34", "본인 신한카드(1234)", "스타벅스 강남점", "12,500", "일시불", "12345678", ""],
      ["2026.09.03", "19:02", "본인 신한카드(1234)", "하나로마트 양재점", "84,300", "3개월", "22345678", ""],
      ["2026.09.05", "09:10", "본인 신한카드(1234)", "쿠팡", "30,000", "일시불", "32345678", "승인취소"],
      ["합계", "", "", "", "126,800", "", "", ""],
    ];
    const r = parseStatement({ rows, fileName: "이용내역.xls" }, TODAY).messages;
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ date: "2026-09-01", time: "12:34", merchant: "스타벅스 강남점", amount: 12500, issuer: "신한", cardHint: "1234", installment: "일시불", cancelled: false });
    // 가맹점 이름 속 "하나"를 카드사로 보지 않는다
    expect(r[1]).toMatchObject({ merchant: "하나로마트 양재점", amount: 84300, issuer: "신한", installment: "3개월" });
    expect(r[2]).toMatchObject({ merchant: "쿠팡", cancelled: true });
  });

  it("명세서 모양: 할부개월 숫자, 음수 금액은 취소, 연도 없는 날짜", () => {
    const rows = [
      ["이용일", "이용하신 곳", "이용금액(원)", "할부개월", "회차", "원금", "수수료", "결제 후 잔액"],
      ["09.02", "GS25 역삼점", "4,500", "0", "", "4,500", "0", "0"],
      ["09.04", "하이마트", "1,200,000", "10", "1", "120,000", "5,000", "1,080,000"],
      ["09.06", "GS25 역삼점", "-4,500", "", "", "-4,500", "", ""],
    ];
    const { messages: r, cancelledPairs } = parseStatement({ rows, fileName: "현대카드_명세서.xlsx" }, TODAY);
    // 09.02 결제와 09.06 취소는 짝이라 둘 다 뺀다
    expect(cancelledPairs).toBe(1);
    expect(r.map((x) => [x.date, x.merchant, x.amount, x.installment, x.cancelled, x.issuer])).toEqual([
      ["2026-09-04", "하이마트", 1200000, "10개월", false, "현대"],
    ]);
  });

  it("삼성 모양: 승인일자·승인금액·취소여부, 여러 시트 머리글 반복", () => {
    const rows = [
      ["승인일자", "승인시각", "카드번호", "가맹점명", "승인금액(원)", "일시불/할부", "취소여부"],
      ["20260910", "083000", "5310-****-****-9876", "배달의민족", "23000", "일시불", "N"],
      ["승인일자", "승인시각", "카드번호", "가맹점명", "승인금액(원)", "일시불/할부", "취소여부"],
      ["20260911", "", "5310-****-****-1111", "이마트", "56,700", "일시불", "취소"],
    ];
    const r = parseStatement({ rows, fileName: "samsungcard.csv" }, TODAY).messages;
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ date: "2026-09-10", merchant: "배달의민족", amount: 23000, cardHint: "9876", cancelled: false });
    expect(r[1]).toMatchObject({ merchant: "이마트", cardHint: "1111", cancelled: true });
  });

  it("짝이 없는 취소는 남기고, 같은 금액이라도 가맹점이 다르면 짝이 아니다", () => {
    const rows = [
      ["이용일", "가맹점", "이용금액"],
      ["2026.09.01", "A마트", "10,000"],
      ["2026.09.02", "B마트", "-10,000"],
    ];
    const r = parseStatement({ rows }, TODAY);
    expect(r.cancelledPairs).toBe(0);
    expect(r.messages.map((x) => [x.merchant, x.cancelled])).toEqual([
      ["A마트", false],
      ["B마트", true],
    ]);
  });

  it("머리글이 없으면 줄 모양으로 읽는다", () => {
    const rows = [
      ["2026-09-12", "스타벅스", "5,600"],
      ["메모", "", ""],
    ];
    expect(parseStatement({ rows }, TODAY).messages).toMatchObject([{ date: "2026-09-12", merchant: "스타벅스", amount: 5600 }]);
  });
});

describe("parseStatement: PDF 글자 줄", () => {
  it("명세서 줄에서 날짜·가맹점·첫 금액", () => {
    const lines = [
      "KB국민카드 2026년 10월 이용대금명세서",
      "결제일 2026.10.14",
      "이용일자 이용카드 이용하신 곳 이용금액 할부 회차 원금 수수료",
      "2026.09.01 본인 1234 스타벅스 강남점 12,500 12,500",
      "26.09.03 본인 1234 롯데마트 잠실점 240,000 3개월 1 80,000 1,920",
      "09/05 가족 5678 넷플릭스 17,000원",
      "2026.09.07 본인 1234 쿠팡 승인취소 -30,000",
      "합계 239,500",
      "고객센터 1588-1688",
    ];
    const r = parseStatement({ lines, fileName: "statement.pdf" }, TODAY).messages;
    expect(r.map((x) => [x.date, x.merchant, x.amount, x.issuer, x.cancelled])).toEqual([
      ["2026-09-01", "스타벅스 강남점", 12500, "KB국민", false],
      ["2026-09-03", "롯데마트 잠실점", 240000, "KB국민", false],
      ["2026-09-05", "넷플릭스", 17000, "KB국민", false],
      ["2026-09-07", "쿠팡 승인취소", 30000, "KB국민", true],
    ]);
    expect(r[1]).toMatchObject({ installment: "3개월", cardHint: "1234" });
    expect(r[2].cardHint).toBe("5678");
  });
});
