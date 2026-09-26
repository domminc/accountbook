-- Supabase는 public 스키마의 새 테이블·함수에 anon·authenticated 권한을 기본으로 준다.
-- 이 앱은 서버에서만 DB에 접속하므로(비로그인 anon 불필요) 필요한 권한만 남긴다.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- 로그인 사용자도 직접 부를 필요가 없는 내부 함수
revoke execute on function public.seed_household_defaults(uuid) from authenticated;

-- 비밀번호 해시가 있는 users 는 서버(테이블 소유자)만
revoke all on public.users from authenticated;

-- 초대는 만들기·보기·취소만. 수락 표시는 accept_invite() 가 한다.
revoke update on public.household_invites from authenticated;
