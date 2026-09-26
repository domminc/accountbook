-- 문자 자동 입력: 휴대폰 자동화(아이폰 단축어, 안드로이드 MacroDroid 등)가 카드 문자를 POST /api/sms 로 보낸다.

-- 기기별 토큰. 토큰 원문은 만들 때 한 번만 보여주고 DB에는 SHA-256 해시만 둔다.
create table public.inbound_tokens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 30),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- 받은 문자. 같은 문자를 두 번 받으면 한 번만 처리한다 (raw_hash).
-- saved: 거래로 저장함, pending: 사람이 확인해야 함, dismissed: 확인하고 버림
create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  received_by uuid references public.users (id) on delete set null,
  raw text not null check (length(raw) between 1 and 2000),
  raw_hash text not null check (raw_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'saved', 'dismissed')),
  transaction_id uuid,
  received_at timestamptz not null default now(),
  unique (household_id, raw_hash),
  foreign key (transaction_id, household_id) references public.transactions (id, household_id) on delete set null (transaction_id)
);
create index sms_messages_pending on public.sms_messages (household_id) where status = 'pending';

alter table public.inbound_tokens enable row level security;
alter table public.sms_messages enable row level security;

-- 토큰: 같은 가계부 구성원이 목록을 보고 지울 수 있다. 만들 때는 자기 이름으로만.
create policy inbound_tokens_select on public.inbound_tokens for select to authenticated
  using (public.is_household_member(household_id));
create policy inbound_tokens_insert on public.inbound_tokens for insert to authenticated
  with check (public.is_household_member(household_id) and user_id = public.current_user_id());
create policy inbound_tokens_delete on public.inbound_tokens for delete to authenticated
  using (public.is_household_member(household_id));
create policy inbound_tokens_touch on public.inbound_tokens for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
grant select, insert, delete on public.inbound_tokens to authenticated;
grant update (last_used_at) on public.inbound_tokens to authenticated;
revoke all on public.inbound_tokens from anon;

create policy sms_messages_member_all on public.sms_messages for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
grant select, insert, delete on public.sms_messages to authenticated;
grant update (status, transaction_id) on public.sms_messages to authenticated;
revoke all on public.sms_messages from anon;
