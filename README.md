# accountbook

부부가 함께 쓰는 웹 가계부. 구글 시트 가계부(디어나 가계부 템플릿)를 웹으로 옮긴다.

- 기획서: [docs/PLANNING.md](docs/PLANNING.md)
- 스택: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL (Supabase 등)

## 처음 설정하기

### 1. PostgreSQL 준비

PostgreSQL 15 이상이면 어디든 된다. Supabase를 쓰는 경우:

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다. 지역은 `Northeast Asia (Seoul)`.
2. 프로젝트 화면 위쪽 **Connect** → **Session pooler** 연결 문자열을 복사한다. (`[YOUR-PASSWORD]` 자리에 DB 비밀번호)

### 2. DB 스키마 적용

`supabase/migrations/` 안의 SQL 파일을 이름 순서대로 실행한다. 둘 중 하나:
- Supabase **SQL Editor**에 붙여넣고 실행
- `psql "$DATABASE_URL" -f supabase/migrations/20260926000000_init.sql`

### 3. 로컬 실행

```bash
cp .env.example .env.local   # DATABASE_URL, SESSION_SECRET 입력
npm install
npm run dev                  # http://localhost:3000
```

`/signup`에서 아이디·비밀번호를 만들고, 가계부 이름과 내 이름을 입력하면 기본 카테고리·지출방법·태그가 함께 만들어진다.

### 기존 시트 옮기기

**설정 → 데이터 가져오기·내보내기**에서 구글 시트를 xlsx로 받아 연도별로 올린다. 파일은 브라우저에서만 읽고, 월별 합계 미리보기를 확인한 뒤 가져온다. 실사용 전 입력분이 있으면 "이 날짜부터 가져오기"로 뺀다 (예: 2025-11-01).

## 화면

| 메뉴 | 내용 |
|---|---|
| 홈 | 이달의 정리: 남은 금액·수입·지출·저축·저축률, 목표 달성률, 대분류별 예산, 저축·지출 비중, 무지출 Day, 결제 수단별·태그별, 이달의 이벤트 |
| 내역 | 월별 거래 목록·달력, 검색·필터, 입력·수정·삭제, 지난달 고정지출 가져오기 |
| 예비비 | 연도별 분류·입금·지출·잔액 |
| 연간 | 수입·저축·지출·예비비 월별 상세표, 월평균 |
| 설정 | 카테고리·지출방법·태그, 데이터 가져오기·내보내기 |
| (홈에서) | 목표·예산 입력, 주간별 표 |

> 배우자 초대(같은 가계부 함께 쓰기)는 5단계에서 추가한다. 지금은 아이디마다 따로 가계부가 만들어진다.

### 로그인 방식

- 지금은 **아이디·비밀번호** 로그인이다. 비밀번호는 scrypt로 해시해 `public.users`에 저장하고, 로그인하면 서명된 쿠키(30일)로 세션을 유지한다.
- 구글·카카오 로그인 코드(Supabase Auth)는 `/login/oauth`에 보관 중이다. 다시 쓰는 방법은 [src/lib/supabase/README.md](src/lib/supabase/README.md).

## 개발

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run lint` | ESLint |
| `npm run typecheck` | 라우트 타입 생성 후 TypeScript 검사 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:db` | 임시 Postgres에 마이그레이션을 적용하고 RLS·제약 조건 테스트 (Postgres 15+ 필요) |
| `npm run test:e2e` | 임시 Postgres + 빌드한 앱으로 Playwright 브라우저 테스트 (Postgres 15+, Chromium 필요) |

### 폴더 구조

```
src/
  app/
    login/ signup/      아이디·비밀번호 로그인, 가입
    login/oauth/ auth/  구글·카카오 로그인 (보관 중)
    onboarding/         가계부 만들기
    (app)/              로그인 후 화면 (홈, 내역, 설정)
  lib/
    db.ts               DB 연결, withUser() — 사용자 권한으로 쿼리해 RLS 적용
    auth.ts session.ts  로그인 세션 쿠키
    data/               화면에서 쓰는 조회 함수
  proxy.ts              비로그인 사용자 /login 으로 이동
e2e/                    Playwright 테스트
supabase/
  migrations/           DB 스키마·RLS
  tests/                DB·RLS 테스트
```

### 데이터 보안

- 앱 서버는 요청마다 `withUser()`로 로그인 사용자 권한(`authenticated` 역할 + 사용자 id)을 설정한 뒤 쿼리한다. 그래서 모든 테이블의 가구(`household_id`) 단위 RLS가 그대로 적용되어, 같은 가계부 구성원만 읽고 쓸 수 있다.
- 거래·예산 등은 복합 FK로 같은 가구의 카테고리·지출방법만 참조할 수 있다.
- 시트 원본(xlsx·csv)은 `.gitignore`로 커밋하지 않는다.
