#!/usr/bin/env bash
# 임시 Postgres + 프로덕션 빌드 서버를 띄우고 Playwright E2E 테스트를 실행한다.
# 필요: Postgres 15+ 바이너리, Playwright 브라우저(chromium)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
TMP="$(mktemp -d)"
PG_PORT="${E2E_PG_PORT:-54330}"
APP_PORT="${E2E_APP_PORT:-3200}"
APP_PID=""

cleanup() {
  if [ -n "$APP_PID" ]; then
    pkill -P "$APP_PID" 2>/dev/null || true
    kill "$APP_PID" 2>/dev/null || true
  fi
  run "'$PG_BIN/pg_ctl' -D '$TMP/data' -m immediate stop >/dev/null 2>&1" || true
  rm -rf "$TMP"
}
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
run "'$PG_BIN/pg_ctl' -D '$TMP/data' -o '-p $PG_PORT -k $TMP -c listen_addresses=127.0.0.1' -l '$TMP/log' -w start >/dev/null"

for f in "$ROOT"/supabase/migrations/*.sql; do
  "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -f "$f"
done

export DATABASE_URL="postgres://postgres@127.0.0.1:$PG_PORT/postgres"
export SESSION_SECRET="e2e-secret-$(date +%s)-0123456789abcdef0123456789"

cd "$ROOT"
if [ "${E2E_SKIP_BUILD:-}" != "1" ]; then npx next build >/dev/null; fi
"$ROOT/node_modules/.bin/next" start -p "$APP_PORT" > "$TMP/app.log" 2>&1 &
APP_PID=$!
for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://localhost:$APP_PORT/login" && break
  sleep 0.5
done

E2E_BASE_URL="http://localhost:$APP_PORT" npx playwright test "$@" || { echo "--- app log ---"; tail -50 "$TMP/app.log"; exit 1; }
