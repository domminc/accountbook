import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, createSignedValue, readSignedValue, verifySessionToken } from "./session";
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

describe("signed value", () => {
  it("같은 용도로, 만료 전에만 읽힌다", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const token = createSignedValue("passkey-auth", "challenge-1", 300, now);
    expect(readSignedValue("passkey-auth", token, now + 299_000)).toBe("challenge-1");
    expect(readSignedValue("passkey-auth", token, now + 301_000)).toBeNull();
    expect(readSignedValue("passkey-register", token, now)).toBeNull();
  });

  it("변조했거나 세션 토큰이면 거절, 세션 자리에도 쓸 수 없다", () => {
    const token = createSignedValue("passkey-auth", "x", 300);
    expect(readSignedValue("passkey-auth", `${token.slice(0, -2)}xx`)).toBeNull();
    expect(readSignedValue("passkey-auth", createSessionToken("00000000-0000-0000-0000-00000000000a"))).toBeNull();
    expect(verifySessionToken(token)).toBeNull();
    expect(readSignedValue("passkey-auth", undefined)).toBeNull();
    expect(readSignedValue("passkey-auth", "garbage")).toBeNull();
    // 세션 토큰과 같은 모양(payload.서명)이라도 서명이 달라 세션으로 통하지 않는다
    const [data] = token.split(".");
    expect(verifySessionToken(`${data}.${createSessionToken("00000000-0000-0000-0000-00000000000a").split(".")[1]}`)).toBeNull();
  });
});
