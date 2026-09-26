import { describe, expect, it } from "vitest";
import { parseMessage } from "./sms";
import { normalizeMemo, suggestRows, type SuggestContext } from "./sms-suggest";

const TODAY = "2026-09-26";
const ctx = (p: Partial<SuggestContext> = {}): SuggestContext => ({
  cards: [],
  paymentMethods: [
    { id: "pm-check", name: "체크카드" },
    { id: "pm-cash", name: "현금" },
    { id: "pm-shinhan", name: "신한카드" },
  ],
  history: new Map(),
  existing: [],
  ...p,
});
const msg = (text: string) => parseMessage(text, TODAY)!;

describe("suggestRows", () => {
  it("카드사가 같은 카드에 연결한 지출방법을 먼저 쓴다", () => {
    const c = ctx({ cards: [{ name: "생활비카드", issuer: "KB국민카드", paymentMethodId: "pm-check" }] });
    const [row] = suggestRows([msg("KB국민카드1234승인 10,000원 09/26 12:00 마트")], c);
    expect(row.paymentMethodId).toBe("pm-check");
  });

  it("연결한 카드가 없으면 이름에 카드사가 든 지출방법", () => {
    const [row] = suggestRows([msg("신한카드(1234)승인 10,000원 09/26 12:00 마트")], ctx());
    expect(row.paymentMethodId).toBe("pm-shinhan");
  });

  it("카드사로 못 찾으면 그 가맹점에서 지난번에 쓴 지출방법·소분류", () => {
    const history = new Map([[normalizeMemo("스타 벅스"), { categoryId: "cat-cafe", paymentMethodId: "pm-cash" }]]);
    const [row] = suggestRows([msg("삼성카드 승인 5,000원 09/26 09:00 스타벅스")], ctx({ history }));
    expect(row).toMatchObject({ categoryId: "cat-cafe", paymentMethodId: "pm-cash" });
  });

  it("같은 날 같은 금액이 이미 있으면 중복 의심", () => {
    const existing = [{ date: "2026-09-26", amount: 5_000, memo: "커피" }];
    const rows = suggestRows(
      [msg("삼성카드 승인 5,000원 09/26 09:00 스타벅스"), msg("삼성카드 승인 6,000원 09/26 09:00 스타벅스")],
      ctx({ existing }),
    );
    expect(rows.map((r) => r.duplicateOf)).toEqual(["커피", null]);
  });
});
