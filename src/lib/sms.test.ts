import { describe, expect, it } from "vitest";
import { parseMessage, parseMessages, splitMessages } from "./sms";

// 카드사 문자 모양을 흉내 낸 예시 (실제 문자·개인 정보 아님)
const TODAY = "2026-09-26";

describe("parseMessage", () => {
  it.each([
    [
      "신한 (한 줄)",
      "신한카드(1234)승인 홍*동 12,500원(일시불)09/26 12:34 스타벅스 누적1,234,567원",
      { issuer: "신한", amount: 12_500, date: "2026-09-26", time: "12:34", merchant: "스타벅스", installment: "일시불", cardHint: "1234" },
    ],
    [
      "삼성 (여러 줄)",
      "삼성1234승인 홍*동\n45,000원 일시불\n09/25 18:02 이마트 성수점\n누적 512,300원",
      { issuer: "삼성", amount: 45_000, date: "2026-09-25", merchant: "이마트 성수점", cardHint: "1234" },
    ],
    [
      "현대 (가맹점 다음 줄)",
      "현대카드 M 승인\n홍*동\n8,900원 일시불\n09/26 08:15\nGS25 역삼점\n누적 812,000원",
      { issuer: "현대", amount: 8_900, time: "08:15", merchant: "GS25 역삼점" },
    ],
    [
      "KB국민 할부",
      "KB국민카드1234승인\n홍*동님\n33,000원 3개월\n09/25 20:11\n쿠팡\n누적1,234,000원",
      { issuer: "KB국민", amount: 33_000, merchant: "쿠팡", installment: "3개월" },
    ],
    [
      "하나 (슬래시)",
      "하나카드(1234) 승인\n홍*동님\n6,000원 일시불\n09/24 07:50 / 메가커피\n누적 100,000원",
      { issuer: "하나", amount: 6_000, merchant: "메가커피" },
    ],
    [
      "NH 총누적",
      "NH카드3*4*승인\n홍*동\n22,000원 일시불\n09/23 19:30\n배달의민족\n총누적 456,000원",
      { issuer: "NH농협", amount: 22_000, merchant: "배달의민족", cardHint: "3*4*" },
    ],
    [
      "우리카드인데 가맹점이 하나로마트",
      "우리(1234)승인\n홍*동님\n11,000원 일시불\n09/23 12:10\n하나로마트\n누적 90,000원",
      { issuer: "우리", merchant: "하나로마트" },
    ],
    [
      "BC 한 줄",
      "BC(1234)승인 홍*동 7,700원 일시불 09/22 15:00 올리브영",
      { issuer: "BC", amount: 7_700, merchant: "올리브영" },
    ],
  ])("%s", (_name, text, expected) => {
    expect(parseMessage(text, TODAY)).toMatchObject({ ...expected, cancelled: false, dateGuessed: false });
  });

  it("취소 문자는 cancelled", () => {
    const m = parseMessage("신한카드(1234)승인취소 홍*동 12,500원(일시불)09/26 12:40 스타벅스", TODAY);
    expect(m).toMatchObject({ cancelled: true, amount: 12_500, merchant: "스타벅스" });
  });

  it("오늘보다 뒤 날짜는 작년 문자", () => {
    expect(parseMessage("신한카드 승인 5,000원 12/31 23:59 편의점", "2027-01-02")?.date).toBe("2026-12-31");
  });

  it("날짜가 없으면 오늘로 두고 표시", () => {
    expect(parseMessage("삼성카드 승인 5,000원 편의점", TODAY)).toMatchObject({ date: TODAY, dateGuessed: true, amount: 5_000 });
  });

  it("원화 금액이 없으면 amount null", () => {
    expect(parseMessage("현대카드 해외승인 USD 12.50 09/20 10:00 AMAZON", TODAY)).toMatchObject({ amount: null, merchant: "AMAZON" });
  });

  it("금액도 날짜도 없으면 거래 문자가 아님", () => {
    expect(parseMessage("안녕하세요 광고입니다", TODAY)).toBeNull();
  });
});

describe("splitMessages / parseMessages", () => {
  it("[Web발신] 으로 나눈다", () => {
    const text = "[Web발신]\n신한카드 승인 1,000원 09/01 10:00 A\n[Web발신]\n삼성카드 승인 2,000원 09/02 11:00 B";
    expect(splitMessages(text)).toHaveLength(2);
    expect(parseMessages(text, TODAY).map((m) => [m.amount, m.merchant])).toEqual([
      [1_000, "A"],
      [2_000, "B"],
    ]);
  });

  it("표시가 없으면 빈 줄로 나눈다", () => {
    expect(splitMessages("신한 1,000원 09/01 10:00 A\n\n삼성 2,000원 09/02 11:00 B\n\n\n")).toHaveLength(2);
  });
});
