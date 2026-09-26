import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";
import { hashPassword, verifyPassword } from "./password";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123";
});

describe("session token", () => {
  const uid = "00000000-0000-0000-0000-00000000000a";

  it("만든 토큰은 검증된다", () => {
    expect(verifySessionToken(createSessionToken(uid))).toBe(uid);
  });

  it("변조된 토큰은 거절", () => {
    const token = createSessionToken(uid);
    const [data, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "someone-else", exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${data}.x${sig.slice(1)}`)).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });

  it("만료된 토큰은 거절", () => {
    const issued = Date.parse("2026-01-01T00:00:00Z");
    const token = createSessionToken(uid, issued);
    expect(verifySessionToken(token, issued + 29 * 86400_000)).toBe(uid);
    expect(verifySessionToken(token, issued + 31 * 86400_000)).toBeNull();
  });
});

describe("password", () => {
  it("맞는 비밀번호만 통과", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });
});
