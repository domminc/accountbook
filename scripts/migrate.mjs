#!/usr/bin/env node
// supabase/migrations 의 SQL 을 이름 순서대로, 아직 적용하지 않은 것만 실행한다.
// Vercel 은 배포할 때 package.json 의 "vercel-build" 로 이 스크립트를 먼저 돌린다. (SQL Editor 에 붙여넣지 않아도 됨)
// 적용 기록은 accountbook_meta.migrations 에 남긴다 (Data API 로 노출되지 않는 별도 스키마).
//
//   DATABASE_URL=... node scripts/migrate.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { resolveDatabaseUrl } from "../src/lib/db-url.mjs";

const DIR = join(import.meta.dirname, "..", "supabase", "migrations");

// SQL Editor 로 먼저 적용해 둔 DB 를 알아보는 표시. 이미 있으면 실행하지 않고 적용됨으로 기록한다.
// (null = 몇 번 실행해도 되는 파일이라 기록이 없으면 그냥 실행)
const MARKERS = {
  "20260926000000_init.sql": "select to_regclass('public.households') is not null as ok",
  "20260927000000_event_import_batch.sql":
    "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'month_events' and column_name = 'import_batch_id') as ok",
  "20260928000000_invites.sql": "select to_regclass('public.household_invites') is not null as ok",
  "20260929000000_harden_grants.sql": null,
  "20260930000000_finance.sql": "select to_regclass('public.loans') is not null as ok",
  "20261001000000_card_payment_method.sql":
    "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cards' and column_name = 'payment_method_id') as ok",
  "20261002000000_spending_limits.sql": "select to_regclass('public.spending_limits') is not null as ok",
  "20261003000000_receipts.sql": "select to_regclass('public.transaction_receipts') is not null as ok",
  "20261004000000_sms_inbound.sql": "select to_regclass('public.inbound_tokens') is not null as ok",
};

const { url, source } = resolveDatabaseUrl();
if (url) console.log(`migrate: DB 주소 — ${source}`);
if (!url) {
  // 배포는 계속한다: 사이트의 /api/health 에서 무엇이 빠졌는지 볼 수 있게
  console.warn("migrate: 경고 — DATABASE_URL 환경 변수가 없어 DB 적용을 건너뜀. /api/health 에서 확인하세요.");
  process.exit(0);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15, onnotice: () => {} });
try {
  await sql`select 1`;
} catch (e) {
  // 접속 자체가 안 되면(주소·비밀번호 오류 등) 배포는 계속하고 /api/health 에서 원인을 보게 한다
  console.warn("migrate: 경고 — DB 에 접속하지 못해 적용을 건너뜀:", e instanceof Error ? e.message.replace(/\/\/[^@\s]*@/g, "//****@") : e);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(0);
}
try {
  await sql.unsafe(`
    create schema if not exists accountbook_meta;
    revoke all on schema accountbook_meta from public;
    create table if not exists accountbook_meta.migrations (
      name text primary key,
      applied_at timestamptz not null default now(),
      how text not null default 'applied'
    );
  `);
  const done = new Set((await sql`select name from accountbook_meta.migrations`).map((r) => r.name));
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const name of files) {
    if (done.has(name)) continue;
    const marker = MARKERS[name];
    if (marker) {
      const [{ ok }] = await sql.unsafe(marker);
      if (ok) {
        await sql`insert into accountbook_meta.migrations (name, how) values (${name}, 'found')`;
        console.log(`migrate: ${name} — 이미 적용돼 있어 기록만 남김`);
        continue;
      }
    }
    const body = readFileSync(join(DIR, name), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into accountbook_meta.migrations (name) values (${name})`;
    });
    console.log(`migrate: ${name} — 적용`);
  }
  console.log("migrate: DB 가 최신이에요.");
} catch (e) {
  console.error("migrate: 실패 —", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
