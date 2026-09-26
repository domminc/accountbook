import { describe, expect, it } from "vitest";
import { inviteTokenHash, newInviteToken } from "./invite";

describe("invite token", () => {
  it("추측하기 어려운 URL 안전 토큰", () => {
    const a = newInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newInviteToken()).not.toBe(a);
  });

  it("SHA-256 hex (DB 함수와 같은 값)", () => {
    // select encode(sha256(convert_to('tok-valid','UTF8')),'hex')
    expect(inviteTokenHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
