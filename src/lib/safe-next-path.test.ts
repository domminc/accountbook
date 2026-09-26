import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("같은 사이트 경로는 그대로 둔다", () => {
    expect(safeNextPath("/transactions?month=2026-01")).toBe("/transactions?month=2026-01");
    expect(safeNextPath("/")).toBe("/");
  });

  it("값이 없으면 기본 경로", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(null, "/onboarding")).toBe("/onboarding");
  });

  it("외부 주소는 막는다", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/\t/evil.com")).toBe("/");
    expect(safeNextPath("evil.com")).toBe("/");
  });
});
