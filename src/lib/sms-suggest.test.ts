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
    const history = new Map([[normalizeMemo("스타 벅스"), { categoryId: "cat-cafe", paymentMethodId: "pm-cash", tagIds: ["tag-regret"] }]]);
    const [row] = suggestRows([msg("삼성카드 승인 5,000원 09/26 09:00 스타벅스")], ctx({ history }));
    expect(row).toMatchObject({ categoryId: "cat-cafe", paymentMethodId: "pm-cash", tagIds: ["tag-regret"] });
  });

  it("같은 날 같은 금액이 이미 있으면 중복 의심", () => {
    const existing = [{ date: "2026-09-26", amount: 5_000, memo: "커피" }];
    const rows = suggestRows(
      [msg("삼성카드 승인 5,000원 09/26 09:00 스타벅스"), msg("삼성카드 승인 6,000원 09/26 09:00 스타벅스")],
      ctx({ existing }),
    );
    expect(rows.map((r) => r.duplicateOf)).toEqual([{ memo: "커피", date: "2026-09-26", kind: "same_day" }, null]);
  });

  it("3일 안의 같은 금액, 같은 달 고정지출의 같은 금액도 중복 의심", () => {
    const existing = [
      { date: "2026-09-23", amount: 7_000, memo: "점심" },
      { date: "2026-09-22", amount: 7_000, memo: "더 먼 점심" },
      { date: "2026-09-01", amount: 55_000, memo: "휴대폰 요금", fixed: true },
      { date: "2026-09-01", amount: 9_900, memo: "간식" },
      { date: "2026-08-25", amount: 12_000, memo: "지난달 고정", fixed: true },
    ];
    const rows = suggestRows(
      [
        msg("삼성카드 승인 7,000원 09/26 12:00 식당"),
        msg("삼성카드 승인 55,000원 09/20 09:00 SKT"),
        msg("삼성카드 승인 9,900원 09/20 09:00 편의점"),
        msg("삼성카드 승인 12,000원 09/20 09:00 넷플릭스"),
      ],
      ctx({ existing }),
    );
    expect(rows.map((r) => r.duplicateOf)).toEqual([
      { memo: "점심", date: "2026-09-23", kind: "near" },
      { memo: "휴대폰 요금", date: "2026-09-01", kind: "fixed_month" },
      null, // 고정지출이 아니고 3일보다 멀다
      null, // 고정지출이지만 다른 달
    ]);
  });
});
