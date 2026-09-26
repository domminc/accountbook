# 배포 안내 (Vercel + Supabase)

한 번만 설정하면 이후에는 GitHub에 올리는 것만으로 배포된다. 둘 다 무료 플랜으로 충분하다.

## 1. Supabase (데이터베이스)

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다.
   - Region: **Northeast Asia (Seoul)**
   - Database Password: 길게 만들고 따로 적어 둔다.
2. 왼쪽 메뉴 **SQL Editor**에서 `supabase/migrations/` 폴더의 파일을 **이름 순서대로** 하나씩 붙여넣고 **Run**.
   - `20260926000000_init.sql`
   - `20260927000000_event_import_batch.sql`
   - `20260928000000_invites.sql`
   - `20260929000000_harden_grants.sql`
   - `20260930000000_finance.sql`
   - `20261001000000_card_payment_method.sql`
   - `20261002000000_spending_limits.sql`
3. 이 앱은 Supabase의 자동 API(PostgREST)와 로그인(Auth)을 쓰지 않는다. 쓰지 않는 입구는 닫아 둔다.
   - **Project Settings → Data API**: Data API 끄기 (또는 Exposed schemas에서 `public` 빼기)
   - **Authentication → Sign In / Providers**: *Allow new users to sign up* 끄기
4. 프로젝트 화면 위쪽 **Connect** → **Transaction pooler** 연결 문자열을 복사한다. `[YOUR-PASSWORD]`는 1번의 비밀번호로 바꾼다.
   ```
   postgres://postgres.<프로젝트ref>:<비밀번호>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
   ```
   Vercel 같은 서버리스 환경은 연결이 자주 새로 생기므로 Transaction pooler(6543)를 쓴다. 앱은 이 풀러에 맞게 prepared statement를 끄고 접속한다.

## 2. Vercel (웹 서버)

1. [vercel.com](https://vercel.com)에 GitHub 계정으로 로그인하고 **Add New → Project**에서 이 저장소를 고른다.
2. **Environment Variables**에 두 개를 넣는다.

   | 이름 | 값 |
   |---|---|
   | `DATABASE_URL` | 1-4에서 복사한 연결 문자열 |
   | `SESSION_SECRET` | 32자 이상 아무 문자열. 예: 터미널에서 `openssl rand -base64 48` |

3. **Deploy**. 끝나면 `https://<프로젝트>.vercel.app` 주소가 생긴다.
4. 기본 브랜치에 올릴 때마다 자동으로 다시 배포된다. 다른 브랜치는 미리보기 주소로 배포된다.

## 3. 처음 쓰기

1. 배포 주소에서 **아이디 만들기** → **가계부 만들기**
2. **설정 → 데이터 가져오기·내보내기**에서 구글 시트를 연도별 xlsx로 올린다.
   - 2025년 파일은 "이 날짜부터 가져오기"에 `2025-11-01` 입력 (10월 입력분 제외)
   - 미리보기의 월별 수입·지출·저축이 시트와 같은지 보고 **가져오기**
3. **설정 → 구성원·초대**에서 초대 링크를 만들어 배우자에게 보낸다. 배우자는 링크를 열고 아이디를 만들면 바로 같은 가계부로 들어온다.
4. 휴대폰 브라우저 메뉴의 **홈 화면에 추가**로 앱처럼 쓸 수 있다.

## 업데이트할 때

- 새 마이그레이션 파일(`supabase/migrations/`)이 생기면, 배포 **전에** SQL Editor에서 그 파일만 실행한다. 이미 실행한 파일은 다시 실행하지 않는다.
- `SESSION_SECRET`을 바꾸면 모든 기기가 로그아웃된다. (비밀번호는 그대로)

## 백업

- **설정 → 데이터 가져오기·내보내기**의 CSV 내보내기로 거래·예비비를 언제든 받을 수 있다.
- Supabase **Database → Backups**에서 플랜에 따라 자동 백업을 확인할 수 있다.
