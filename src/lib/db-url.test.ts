import { describe, expect, it } from "vitest";
import { projectRef, resolveDatabaseUrl, resolveSessionSecret } from "./db-url.mjs";

const REF = "abcdefghij1234567890";
const POOLER = `postgresql://postgres.${REF}:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;

describe("resolveDatabaseUrl", () => {
  it("DATABASE_URL 이 제대로 있으면 그대로", () => {
    const url = POOLER.replace("[YOUR-PASSWORD]", "pw1234");
    expect(resolveDatabaseUrl({ DATABASE_URL: url })).toEqual({ url, source: "DATABASE_URL" });
  });

  it("[YOUR-PASSWORD] 가 남아 있으면 같은 프로젝트의 연동 비밀번호로 채움", () => {
    const r = resolveDatabaseUrl({
      DATABASE_URL: POOLER,
      POSTGRES_PASSWORD: "p@ss/word",
      POSTGRES_URL: `postgres://postgres.${REF}:x@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`,
    });
    expect(r.url).toBe(POOLER.replace("[YOUR-PASSWORD]", "p%40ss%2Fword"));
    expect(r.source).toContain("POSTGRES_PASSWORD");
  });

  it("다른 프로젝트 연동이면 연동 주소(POSTGRES_URL)를 쓰고 모르는 쿼리는 뺀다", () => {
    const r = resolveDatabaseUrl({
      DATABASE_URL: POOLER,
      POSTGRES_PASSWORD: "x",
      POSTGRES_URL: "postgres://postgres.other0000000:secret@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x",
    });
    expect(r).toEqual({
      url: "postgres://postgres.other0000000:secret@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require",
      source: "POSTGRES_URL(연동)",
    });
  });

  it("아무것도 쓸 수 없으면 DATABASE_URL 을 그대로 (오류는 /api/health 에서 보인다)", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: POOLER }).source).toBe("DATABASE_URL (사용할 수 없음)");
    expect(resolveDatabaseUrl({})).toEqual({ url: null, source: "없음" });
  });

  it("비밀번호 없는 로컬 주소도 그대로 쓴다", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://postgres@127.0.0.1:5432/postgres" }).url).toBe("postgres://postgres@127.0.0.1:5432/postgres");
  });
});

describe("resolveSessionSecret", () => {
  it("SESSION_SECRET 이 32자 이상이면 그것", () => {
    expect(resolveSessionSecret({ SESSION_SECRET: "x".repeat(32) })).toEqual({ secret: "x".repeat(32), source: "SESSION_SECRET" });
  });

  it("없으면 연동 비밀값에서 늘 같은 값을 만든다", () => {
    const a = resolveSessionSecret({ SUPABASE_JWT_SECRET: "jwt-secret" });
    expect(a.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(resolveSessionSecret({ SUPABASE_JWT_SECRET: "jwt-secret" }).secret).toBe(a.secret);
    expect(resolveSessionSecret({ SUPABASE_JWT_SECRET: "other" }).secret).not.toBe(a.secret);
  });

  it("비밀값이 하나도 없으면 null", () => {
    expect(resolveSessionSecret({ DATABASE_URL: POOLER }).secret).toBeNull();
  });
});

it("projectRef", () => {
  expect(projectRef(POOLER)).toBe(REF);
  expect(projectRef(`postgres://postgres:x@db.${REF}.supabase.co:5432/postgres`)).toBe(REF);
  expect(projectRef("postgres://postgres@127.0.0.1/x")).toBeNull();
});
