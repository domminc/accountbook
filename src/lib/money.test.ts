import { describe, expect, it } from "vitest";
import { formatWon, parseAmount } from "./money";

describe("money", () => {
  it("천 단위 쉼표", () => {
    expect(formatWon(1234567)).toBe("1,234,567");
  });

  it("입력에서 숫자만 읽는다", () => {
    expect(parseAmount("12,000")).toBe(12000);
    expect(parseAmount("₩ 3,000원")).toBe(3000);
  });

  it("0, 빈 값, 1조 초과는 거절", () => {
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1,000,000,000,001")).toBeNull();
    expect(parseAmount("1,000,000,000,000")).toBe(1_000_000_000_000);
  });
});
