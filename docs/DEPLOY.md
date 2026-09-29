# 배포 안내 (Vercel + Supabase)

한 번만 설정하면 이후에는 GitHub에 올리는 것만으로 배포된다. 둘 다 무료 플랜으로 충분하다.

## 1. Supabase (데이터베이스)

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다.
   - Region: **Northeast Asia (Seoul)**
   - Database Password: 길게 만들고 따로 적어 둔다.
2. DB 표(테이블) 만들기는 **할 일 없음**. Vercel이 배포할 때마다 `supabase/migrations/` 중 아직 적용하지 않은 것을 자동으로 적용한다 (`scripts/migrate.mjs`, 기록은 `accountbook_meta.migrations`).
   - 직접 하고 싶으면 PC에서 `DATABASE_URL=... npm run db:migrate`
3. 이 앱은 Supabase의 자동 API(PostgREST)와 로그인(Auth)을 쓰지 않는다. 쓰지 않는 입구는 닫아 둔다.
   - **Project Settings → Data API**: Data API 끄기 (또는 Exposed schemas에서 `public` 빼기)
   - **Authentication → Sign In / Providers**: *Allow new users to sign up* 끄기
4. 프로젝트 화면 위쪽 **Connect** → **Transaction pooler** 연결 문자열을 복사한다. `[YOUR-PASSWORD]`는 1번의 비밀번호로 바꾼다.
   ```
   postgres://postgres.<프로젝트ref>:<비밀번호>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
   ```
   Vercel 같은 서버리스 환경은 연결이 자주 새로 생기므로 Transaction pooler(6543)를 쓴다. 앱은 이 풀러에 맞게 prepared statement를 끄고 접속한다.

## 2. Vercel (웹 서버)

> **가장 쉬운 방법**: Vercel 프로젝트의 **Storage → Supabase 연동**으로 DB를 연결하면 `POSTGRES_URL`·`SUPABASE_JWT_SECRET` 등이 자동으로 들어가고, 앱은 이것을 먼저 쓴다 (`src/lib/db-url.mjs`). 이때는 아래 `DATABASE_URL`·`SESSION_SECRET`을 넣지 않아도 되고, 표도 배포할 때 자동으로 만들어진다.
> 배포 후 `https://<주소>/api/health`에서 `"상태": "정상"`인지 확인한다 (비밀 값은 보여주지 않음).

1. [vercel.com](https://vercel.com)에 GitHub 계정으로 로그인하고 **Add New → Project**에서 이 저장소를 고른다.
2. **Environment Variables**에 두 개를 넣는다.

   | 이름 | 값 |
   |---|---|
   | `DATABASE_URL` | 1-4에서 복사한 연결 문자열 |
   | `SESSION_SECRET` | 32자 이상 아무 문자열. 예: 터미널에서 `openssl rand -base64 48` |

3. **Deploy**. 빌드 전에 DB 표를 자동으로 만든다 (`vercel.json` → `npm run vercel-build`). 끝나면 `https://<프로젝트>.vercel.app` 주소가 생긴다.
4. 기본 브랜치에 올릴 때마다 자동으로 다시 배포된다. 다른 브랜치는 미리보기 주소로 배포된다.

### 내 도메인 연결 (지금: `https://www.homesell.co.kr`)

지금 설정 (바꾸지 말 것):

| 곳 | 설정 |
|---|---|
| 예스닉 (도메인 등록) | 네임서버 `michael.ns.cloudflare.com`, `raquel.ns.cloudflare.com` |
| Cloudflare (DNS) | `www` CNAME → Vercel이 알려 준 `….vercel-dns-017.com` / `homesell.co.kr`은 Cloudflare를 거쳐 Vercel로 |
| Vercel 프로젝트 Domains | `www.homesell.co.kr` = Production, `homesell.co.kr` → www로 308 |

- `homesell.co.kr`로 들어오면 `https://www.homesell.co.kr/`로 넘어간다. 대표 주소는 www.
- DNS 기록은 **Cloudflare 대시보드**에서만 고친다. 예스닉 DNS 관리나 Vercel DNS에는 기록을 넣지 않는다 (네임서버가 Cloudflare라 효과가 없다).
- 네임서버를 `ns1/ns2.vercel-dns.com`으로 바꾸는 방법은 이 도메인에서 Vercel DNS가 몇 시간 동안 켜지지 않아 쓰지 않았다.
- 확인: `https://www.homesell.co.kr/api/health`가 `"상태": "정상"`.
- 로그인은 주소마다 따로라 새 주소에서 한 번 다시 로그인한다. `accountbook-woad.vercel.app`도 계속 열린다.
- 문자 자동 입력 단축어·자동화 앱 주소는 `https://www.homesell.co.kr/api/sms` (옛 주소도 동작).

## 3. 처음 쓰기

1. 배포 주소에서 **아이디 만들기** → **가계부 만들기**
2. **설정 → 데이터 가져오기·내보내기**에서 구글 시트를 연도별 xlsx로 올린다.
   - 2025년 파일은 "이 날짜부터 가져오기"에 `2025-11-01` 입력 (10월 입력분 제외)
   - 미리보기의 월별 수입·지출·저축이 시트와 같은지 보고 **가져오기**
3. **설정 → 구성원·초대**에서 초대 링크를 만들어 배우자에게 보낸다. 배우자는 링크를 열고 아이디를 만들면 바로 같은 가계부로 들어온다.
4. 휴대폰 브라우저 메뉴의 **홈 화면에 추가**로 앱처럼 쓸 수 있다. 안드로이드는 아래 "안드로이드 앱"으로 Play 스토어에서 설치할 수도 있다.
   - **설정 → 계정·보안 → 이 기기 등록하기**를 하면 다음부터 Face ID·지문으로 로그인한다. 기기마다 한 번씩, 주소(도메인)마다 따로 등록한다.
5. (선택) **설정 → 문자 자동 입력**에서 기기별 토큰을 만들고, 안내대로 아이폰 단축어나 안드로이드 자동화 앱에 넣으면 카드 승인 문자가 오는 대로 가계부에 들어간다.

## 4. 안드로이드 앱 (Google Play)

웹을 그대로 띄우는 안드로이드 앱(TWA, 크롬 기반)으로 올린다. 화면·기능은 웹에서 오므로 **웹을 배포하면 앱도 바로 바뀐다.** 스토어에 다시 올리는 것은 앱 이름·아이콘·패키지 설정을 바꿀 때뿐이다.

### 준비

- [Google Play Console](https://play.google.com/console) 개발자 계정: 등록비 25달러(한 번), 신원 확인.
  - 개인 계정은 정식 출시 전에 **테스터 12명 이상이 14일 동안 비공개 테스트**를 해야 한다 (2023년 11월 이후 만든 계정). 조직 계정은 D-U-N-S 번호가 필요한 대신 이 조건이 없다. 조건은 바뀔 수 있으니 콘솔 안내를 따른다.
  - 가족만 쓸 거라면 **내부 테스트**(초대한 계정만 설치, 최대 100명)로 충분하고 위 조건도 없다.
- `src/lib/legal.ts`의 `〔운영자 이름〕`·`〔문의 이메일〕`을 실제 값으로 바꿔 배포한다. 개인정보처리방침·계정 삭제 안내에 그대로 나온다.
- 심사용 테스트 계정: 아이디를 하나 만들고 가계부까지 만들어 둔다 (거래 몇 건 입력). 아이디·비밀번호를 Play Console "앱 액세스"에 적는다.

### 1) 앱 파일 만들기 (PWABuilder)

1. [pwabuilder.com](https://www.pwabuilder.com)에 `https://www.homesell.co.kr`을 넣고 **Package For Stores → Android → Generate Package**.
2. 옵션
   - Package ID: `kr.co.homesell.accountbook` (**한 번 정하면 못 바꾼다**)
   - App name / Launcher name: `가계부`
   - Signing key: **Create new** (새 서명 키를 만든다)
3. 받은 zip 안의 파일
   - `*.aab`: Play Console에 올리는 파일
   - `*.apk`: 휴대폰에 직접 깔아 보는 테스트용
   - `signing.keystore`, `signing-key-info.txt`: **서명 키와 비밀번호. 다음 업데이트 때 꼭 필요하므로 안전한 곳에 따로 보관한다. 저장소에 커밋하지 않는다.**
   - `assetlinks.json`: 아래 2)에 쓸 지문(`sha256_cert_fingerprints`)이 들어 있다.

### 2) 사이트와 앱 연결

앱이 이 사이트의 주인임을 확인하는 `/.well-known/assetlinks.json`을 환경 변수로 만든다. 확인되지 않으면 앱 위쪽에 주소창이 보인다.

1. Vercel → Settings → Environment Variables (Production)

   | 이름 | 값 |
   |---|---|
   | `ANDROID_PACKAGE_NAME` | `kr.co.homesell.accountbook` |
   | `ANDROID_SHA256_FINGERPRINTS` | PWABuilder `assetlinks.json`의 지문, 쉼표 뒤에 Play Console **앱 무결성 → 앱 서명**의 "앱 서명 키 인증서" SHA-256 지문 |

   Play 앱 서명(기본값)을 쓰면 Play가 앱을 다시 서명하므로 두 지문이 모두 있어야 한다. 앱 서명 지문은 첫 .aab를 올린 뒤에 보이므로, 올린 다음 추가하고 다시 배포한다.
2. 다시 배포(Redeploy)한 뒤 확인
   - `https://www.homesell.co.kr/.well-known/assetlinks.json`에 패키지 이름과 지문이 보인다.
   - `https://www.homesell.co.kr/api/health`의 `안드로이드_앱_연결`이 `있음`.

환경 변수만 넣는 것이고 도메인·DNS 설정은 건드리지 않는다.

### 3) Play Console 입력

| 항목 | 입력 |
|---|---|
| 앱 이름 | 가계부 (겹치는 이름이 많으니 "가계부 - 부부 공유 가계부"처럼 구분해도 됨) |
| 기본 언어 / 종류 | 한국어 / 앱, 무료 |
| 개인정보처리방침 | `https://www.homesell.co.kr/privacy` |
| 앱 액세스 | 로그인 필요 → 테스트 계정 아이디·비밀번호 |
| 광고 | 없음 |
| 콘텐츠 등급 설문 | 폭력·도박·성인 콘텐츠 없음. 사용자끼리 공유는 초대한 가족끼리만 |
| 타겟층 | 만 18세 이상 (만 14세 미만은 가입할 수 없음) |
| 금융 기능 | 예산·지출 기록(개인 재무 관리)만. 대출·송금·결제·투자·신용 기능 없음 |
| 계정 삭제 | 앱에서 계정을 만들 수 있음 → 삭제 URL `https://www.homesell.co.kr/account-deletion` (앱 안: 설정 → 계정·보안 → 회원 탈퇴) |
| 데이터 보안 | 아래 표 |

데이터 보안 (공통: 수집함, 제3자와 공유 안 함, 전송 중 암호화함, 삭제 요청 가능, 목적은 "앱 기능"·"계정 관리")

| 데이터 유형 | 무엇 | 필수/선택 |
|---|---|---|
| 개인 정보 → 사용자 ID | 아이디 | 필수 |
| 개인 정보 → 이름 | 가계부에 보이는 내 이름 | 필수 |
| 금융 정보 → 구매 내역, 기타 금융 정보 | 거래, 예산, 자산·대출·카드·통장(계좌번호 끝 4자리) | 필수 |
| 사진 및 동영상 → 사진 | 영수증 사진 | 선택 |
| 메시지 → SMS 또는 MMS | 문자 자동 입력을 켰을 때 받은 카드 승인 문자 | 선택 |

앱은 문자·연락처·위치 권한을 요청하지 않는다. 문자 자동 입력은 사용자가 설정한 별도 자동화 앱이 보낸 문자만 받는다.

스토어 이미지

- 앱 아이콘 512×512: `public/icon-512.png`
- 그래픽 이미지 1024×500: 새로 만든다
- 휴대폰 스크린샷 2~8장 (세로 9:16, 예: 1080×1920): 테스트 계정으로 이달의 정리·거래 입력·거래 달력·예산 화면

### 4) 테스트와 출시

1. **테스트 및 출시 → 내부 테스트**에 `.aab`를 올리고 테스터 이메일(구글 계정)을 넣는다. 테스터는 초대 링크로 Play 스토어에서 설치한다.
2. 앱을 열어 주소창 없이 열리는지, 로그인·Face ID(지문) 등록·거래 입력이 되는지 확인한다. 주소창이 보이면 2)의 지문을 확인한다.
3. 공개하려면 **비공개 테스트**(개인 계정: 12명·14일) → **프로덕션** 출시 신청. 심사는 보통 며칠 걸린다.

### 앱을 다시 올릴 때

앱 이름·아이콘·바로가기(`src/app/manifest.ts`)를 바꿨을 때만: PWABuilder에서 같은 Package ID, **보관해 둔 서명 키**(Use mine)로 버전 코드를 올려 새 `.aab`를 만들고 새 버전으로 올린다.

### 아이폰

- App Store 대신 Safari **공유 → 홈 화면에 추가**로 쓰고, **설정 → 계정·보안**에서 Face ID를 등록한다.
- 나중에 App Store에 올리려면 Apple Developer Program(연 99달러), Mac·Xcode(또는 클라우드 빌드), Capacitor 같은 도구로 감싸는 작업이 필요하다. 웹만 감싼 앱은 심사(가이드라인 4.2 최소 기능)에서 거절되기 쉬워, 푸시 알림·위젯처럼 웹에 없는 기능을 함께 넣어야 한다. 앱 안에서도 패스키를 쓰려면 `apple-app-site-association` 파일도 필요하다.

## 업데이트할 때

- 새 마이그레이션 파일(`supabase/migrations/`)이 생겨도 배포할 때 자동으로 적용된다. 이미 적용한 파일은 다시 실행하지 않는다.
- 전에 SQL Editor로 일부 파일을 직접 실행했어도 괜찮다. 이미 있는 것은 알아보고 건너뛴다.
- 배포 로그(Vercel → Deployments → Build Logs)에 `migrate: DB 가 최신이에요.`가 보이면 정상이다. 실패하면 배포도 멈추므로 옛 화면이 그대로 유지된다.
- `SESSION_SECRET`을 바꾸면 모든 기기가 로그아웃된다. (비밀번호는 그대로)

## 백업

- **설정 → 데이터 가져오기·내보내기**의 CSV 내보내기로 거래·예비비를 언제든 받을 수 있다.
- Supabase **Database → Backups**에서 플랜에 따라 자동 백업을 확인할 수 있다.
