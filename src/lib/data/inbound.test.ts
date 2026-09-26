import { describe, expect, it } from "vitest";
import { inboundTokenHash, newInboundToken, smsHash } from "./inbound";

describe("문자 자동 입력 토큰·문자 해시", () => {
  it("토큰은 매번 다르고 해시는 64자리 16진수", () => {
    const a = newInboundToken();
    expect(a).toMatch(/^ab_[A-Za-z0-9_-]{32}$/);
    expect(newInboundToken()).not.toBe(a);
    expect(inboundTokenHash(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("같은 문자는 공백·줄바꿈 차이를 무시하고 같은 해시", () => {
    expect(smsHash("신한카드 승인\n 5,000원  09/26 12:00 A ")).toBe(smsHash("신한카드 승인 5,000원 09/26 12:00 A"));
    expect(smsHash("신한카드 승인 5,000원")).not.toBe(smsHash("신한카드 승인 6,000원"));
  });
});
