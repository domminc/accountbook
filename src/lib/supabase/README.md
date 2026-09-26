# Supabase Auth (보관 중)

구글·카카오 로그인용 코드. 지금은 아이디·비밀번호 로그인(`src/lib/auth.ts`)을 쓰고 있어 연결되어 있지 않다.

다시 쓸 때:
- `/login/oauth` 화면, `/auth/callback`, `/auth/signout` 라우트가 이 폴더의 클라이언트를 쓴다.
- 로그인 후 Supabase 사용자(`auth.users.id`)를 `public.users.auth_user_id`로 연결하고 `startSession()`으로 앱 세션을 만들도록 `/auth/callback`을 고쳐야 한다.
- `proxy.ts`의 `updateSession`은 현재 `src/proxy.ts`에서 호출하지 않는다.
