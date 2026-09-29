-- 계정: 내 아이디 보기, 패스키(Face ID·지문) 로그인, 회원 탈퇴

-- 로그인 사용자는 자기 행의 아이디·가입일만 볼 수 있다. 비밀번호 해시는 계속 서버(테이블 소유자)만.
grant select (id, login_id, created_at) on public.users to authenticated;
create policy users_select_self on public.users
  for select to authenticated using (id = (select public.current_user_id()));

-- 패스키: 기기의 Face ID·지문·화면 잠금으로 로그인한다. 공개 키만 저장하고 생체 정보는 기기 밖으로 나오지 않는다.
-- 로그인할 때(세션 없음)는 서버가 credential_id 로 찾아 확인한다.
create table public.passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  credential_id text not null unique check (credential_id ~ '^[A-Za-z0-9_-]+$' and length(credential_id) between 16 and 1400),
  public_key bytea not null check (octet_length(public_key) between 1 and 4096),
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}',
  name text not null check (length(trim(name)) between 1 and 30),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index passkeys_user on public.passkeys (user_id);

alter table public.passkeys enable row level security;
create policy passkeys_own on public.passkeys for all to authenticated
  using (user_id = (select public.current_user_id()))
  with check (user_id = (select public.current_user_id()));
grant select, insert, delete on public.passkeys to authenticated;
grant update (name) on public.passkeys to authenticated;
revoke all on public.passkeys from anon;

-- 회원 탈퇴: 로그인한 사용자를 지운다.
-- - 가계부에 혼자면 가계부와 그 안의 모든 데이터를 지운다.
-- - 함께 쓰는 사람이 있으면 가계부는 남기고 나만 빠진다. 내가 입력한 거래는 남고 입력자 표시만 사라진다.
--   내가 만든 사람(owner)이면 가장 먼저 들어온 구성원이 이어받는다.
-- - 내 패스키·문자 자동 입력 토큰은 같이 지운다 (on delete cascade).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select public.current_user_id());
  hid uuid;
  was_owner boolean;
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = 'insufficient_privilege';
  end if;

  select household_id, role = 'owner' into hid, was_owner from public.members where user_id = uid;
  if hid is not null then
    -- 두 사람이 동시에 탈퇴해도 가계부가 구성원 없이 남지 않게 가계부 행을 잠근다
    perform 1 from public.households where id = hid for update;
    delete from public.members where user_id = uid;
    if not exists (select 1 from public.members where household_id = hid) then
      delete from public.households where id = hid;
    elsif was_owner then
      update public.members set role = 'owner'
      where household_id = hid
        and user_id = (select user_id from public.members where household_id = hid order by created_at, user_id limit 1);
    end if;
  end if;

  delete from public.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
