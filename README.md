# accountbook

부부가 함께 쓰는 웹 가계부. 구글 시트 가계부(디어나 가계부 템플릿)를 웹으로 옮긴다.

- 기획서: [docs/PLANNING.md](docs/PLANNING.md)
- 스택: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL + Auth)

## 처음 설정하기

### 1. Supabase 프로젝트

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다. 지역은 `Northeast Asia (Seoul)`.
2. DB 스키마 적용. 둘 중 하나:
   - **SQL Editor**: `supabase/migrations/` 안의 SQL 파일을 이름 순서대로 붙여넣고 실행
   - **CLI**:
     ```bash
     npx supabase init          # supabase/config.toml 생성 (처음 한 번)
     npx supabase link --project-ref <프로젝트 ref>
     npx supabase db push
     ```
3. **Project Settings → API**에서 `Project URL`과 `Publishable key`를 복사해 둔다.

### 2. 로그인 주소 등록

**Authentication → URL Configuration**
- Site URL: 배포 주소 (예: `https://accountbook.vercel.app`). 로컬만 쓸 때는 `http://localhost:3000`
- Redirect URLs에 추가:
  - `http://localhost:3000/auth/callback`
  - `https://<배포 주소>/auth/callback`

### 3. 구글 로그인

1. [Google Cloud Console](https://console.cloud.google.com/) → API 및 서비스 → 사용자 인증 정보 → **OAuth 클라이언트 ID** 만들기 (유형: 웹 애플리케이션)
2. 승인된 리디렉션 URI: `https://<프로젝트 ref>.supabase.co/auth/v1/callback`
3. 발급된 클라이언트 ID·보안 비밀을 Supabase **Authentication → Sign In / Providers → Google**에 넣고 켠다.

### 4. 카카오 로그인

1. [Kakao Developers](https://developers.kakao.com/)에서 애플리케이션을 만든다.
2. **앱 키**의 `REST API 키` = Client ID
3. **카카오 로그인 → 보안**에서 Client Secret 코드를 만들고 활성화 = Client Secret
4. **카카오 로그인**을 켜고, Redirect URI에 `https://<프로젝트 ref>.supabase.co/auth/v1/callback` 등록
5. **동의항목**: 닉네임, 프로필 사진을 동의 받도록 설정. 이메일(`account_email`)은 비즈 앱 인증이 있어야 받을 수 있다.
6. Supabase **Authentication → Sign In / Providers → Kakao**에 Client ID·Secret을 넣고 켠다. 이메일 동의항목이 없으면 같은 화면의 **Allow users without an email**도 켠다.

### 5. 로컬 실행

```bash
cp .env.example .env.local   # 1-3에서 복사한 값 입력
npm install
npm run dev                  # http://localhost:3000
```

처음 로그인하면 가계부 이름과 내 이름을 입력하는 화면이 나오고, 기본 카테고리·지출방법·태그가 함께 만들어진다.

## 개발

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run lint` | ESLint |
| `npm run typecheck` | 라우트 타입 생성 후 TypeScript 검사 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:db` | 임시 Postgres에 마이그레이션을 적용하고 RLS·제약 조건 테스트 (Postgres 15+ 필요) |

### 폴더 구조

```
src/
  app/                  화면과 라우트
    login/              구글·카카오 로그인
    auth/callback/      로그인 후 세션 발급
    onboarding/         가계부 만들기
  lib/supabase/         Supabase 클라이언트 (브라우저·서버·proxy)
  proxy.ts              세션 갱신, 비로그인 사용자 /login 으로 이동
supabase/
  migrations/           DB 스키마·RLS
  tests/                DB 테스트 (auth_stub.sql 은 로컬 테스트 전용)
```

### 데이터 보안

- 모든 테이블은 가구(`household_id`) 단위 RLS로 막혀 있어, 같은 가계부 구성원만 읽고 쓸 수 있다.
- 거래·예산 등은 복합 FK로 같은 가구의 카테고리·지출방법만 참조할 수 있다.
- 시트 원본(xlsx·csv)은 `.gitignore`로 커밋하지 않는다.
