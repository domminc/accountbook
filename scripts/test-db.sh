#!/usr/bin/env bash
# 임시 Postgres를 띄워 supabase/migrations 와 supabase/tests/rls_test.sql 을 실행한다.
# 필요: Postgres 15+ 바이너리 (initdb, pg_ctl, psql). PG_BIN 으로 경로를 지정할 수 있다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
TMP="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"

cleanup() {
  run "'$PG_BIN/pg_ctl' -D '$TMP/data' -m immediate stop >/dev/null 2>&1" || true
  rm -rf "$TMP"
}
# initdb는 root로 실행할 수 없어서, root면 postgres 사용자로 실행한다
run() {
  if [ "$(id -u)" = "0" ]; then
    chown -R postgres "$TMP"
    su postgres -s /bin/bash -c "$*"
  else
    bash -c "$*"
  fi
}

trap cleanup EXIT

run "'$PG_BIN/initdb' -D '$TMP/data' -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null"
run "'$PG_BIN/pg_ctl' -D '$TMP/data' -o '-p $PORT -k $TMP -c listen_addresses=127.0.0.1' -l '$TMP/log' -w start >/dev/null"

PSQL=("$PG_BIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/rls_test.sql"

# scripts/migrate.mjs (Vercel 배포 때 자동 적용): 새 DB에 두 번 돌려도 되고,
# SQL Editor 로 일부만 적용해 둔 DB 는 이미 있는 것은 건너뛰고 나머지만 적용한다.
"${PSQL[@]}" -c "create database migrate_fresh" -c "create database migrate_partial"
db_url() { echo "postgres://postgres@127.0.0.1:$PORT/$1"; }
DATABASE_URL="$(db_url migrate_fresh)" node "$ROOT/scripts/migrate.mjs" >/dev/null
out="$(DATABASE_URL="$(db_url migrate_fresh)" node "$ROOT/scripts/migrate.mjs")"
echo "$out" | grep -q "적용$" && { echo "FAIL: 두 번째 실행에서 다시 적용함"; echo "$out"; exit 1; }
n=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  n=$((n + 1))
  [ "$n" -le 5 ] && "${PSQL[@]}" -d migrate_partial -f "$f"
done
out="$(DATABASE_URL="$(db_url migrate_partial)" node "$ROOT/scripts/migrate.mjs")"
[ "$(echo "$out" | grep -c "기록만 남김")" -ge 4 ] || { echo "FAIL: 이미 적용한 파일을 알아보지 못함"; echo "$out"; exit 1; }
"${PSQL[@]}" -d migrate_partial -o /dev/null -f "$ROOT/supabase/tests/rls_test.sql"
echo "OK: migrate.mjs (새 DB 두 번, 일부 적용된 DB)"
