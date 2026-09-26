-- 가계부 초대 링크. 링크의 토큰은 저장하지 않고 SHA-256 해시만 저장한다. 7일 안에 한 번만 쓸 수 있다.
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by uuid references public.users (id) on delete set null,
  used_at timestamptz
);

alter table public.household_invites enable row level security;

-- 구성원은 자기 가계부 초대를 만들고, 보고, 취소할 수 있다. 수락은 accept_invite()로만.
create policy household_invites_member_all on public.household_invites for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

grant select, insert, delete on public.household_invites to authenticated;

create function public.invite_token_hash(token text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;

-- 초대 링크를 연 사람(아직 구성원이 아님)에게 가계부 이름과 상태를 알려준다
create function public.invite_info(token text)
returns table (household_name text, status text)
language sql stable security definer set search_path = '' as $$
  select h.name,
    case
      when i.used_at is not null then 'used'
      when i.expires_at < now() then 'expired'
      else 'valid'
    end
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.token_hash = public.invite_token_hash(token);
$$;

revoke all on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to authenticated;

-- 초대 수락: 로그인한 사용자를 그 가계부 구성원으로 추가
create function public.accept_invite(token text, member_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select public.current_user_id());
  inv public.household_invites;
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.members where user_id = uid) then
    raise exception '이미 참여 중인 가계부가 있어요.' using errcode = 'unique_violation';
  end if;

  select * into inv from public.household_invites
  where token_hash = public.invite_token_hash(token)
  for update;

  if not found or inv.used_at is not null or inv.expires_at < now() then
    raise exception '만료되었거나 이미 사용한 초대 링크예요.' using errcode = 'check_violation';
  end if;

  insert into public.members (household_id, user_id, role, display_name)
  values (inv.household_id, uid, 'member', trim(member_name));

  update public.household_invites set used_by = uid, used_at = now() where id = inv.id;
  return inv.household_id;
end;
$$;

revoke all on function public.accept_invite(text, text) from public;
grant execute on function public.accept_invite(text, text) to authenticated;
