#!/usr/bin/env bash
# 임시 Postgres를 띄워 supabase/migrations 와 supabase/tests/rls_test.sql 을 실행한다.
# 필요: Postgres 15+ 바이너리 (initdb, pg_ctl, psql). PG_BIN 으로 경로를 지정할 수 있다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
TMP="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

# initdb는 root로 실행할 수 없어서, root면 postgres 사용자로 실행한다
run() {
  if [ "$(id -u)" = "0" ]; then
    chown -R postgres "$TMP"
    su postgres -s /bin/bash -c "$*"
  else
    bash -c "$*"
  fi
}

run "'$PG_BIN/initdb' -D '$TMP/data' -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null"
run "'$PG_BIN/pg_ctl' -D '$TMP/data' -o '-p $PORT -k $TMP -c listen_addresses=' -l '$TMP/log' -w start >/dev/null"

PSQL=("$PG_BIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -f "$ROOT/supabase/tests/auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/rls_test.sql"
