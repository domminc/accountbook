@AGENTS.md

# Project notes

- 기획서: docs/PLANNING.md (기능 범위, 집계 규칙, 시트 가져오기 매핑). 집계 규칙은 참고 시트와 똑같이 맞춘다.
- 검사: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` (Postgres 바이너리로 임시 DB를 띄워 supabase/migrations 와 supabase/tests/rls_test.sql 실행), `npm run test:e2e` (임시 DB + 빌드한 앱으로 Playwright)
- DB 접근은 `src/lib/db.ts` 의 `withUser()` 로만 한다 (RLS 적용). `db()` 직접 사용은 로그인·가입처럼 사용자가 없을 때만.
- DB 변경은 supabase/migrations 에 새 파일로 추가하고, RLS·제약은 supabase/tests/rls_test.sql 에 테스트를 더한다.
- 사용자 시트 원본(개인 금융 데이터)은 커밋하지 않는다.
