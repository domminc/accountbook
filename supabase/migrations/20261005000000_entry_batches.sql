-- 한꺼번에 저장한 거래 묶음 (카드 문자 붙여넣기·카드 이용내역 파일). 묶음을 지우면 그때 넣은 거래도 같이 지운다 (되돌리기).
create table public.entry_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- file: 카드 이용내역·명세서 파일, text: 문자 붙여넣기, earlier: 이 기능 전에 한꺼번에 저장한 것
  source text not null check (source in ('file', 'text', 'earlier')),
  file_name text check (file_name is null or length(file_name) <= 300),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);
create index entry_batches_household on public.entry_batches (household_id, created_at desc);

alter table public.transactions add column entry_batch_id uuid;
alter table public.transactions
  add constraint transactions_entry_batch_fk
  foreign key (entry_batch_id, household_id) references public.entry_batches (id, household_id) on delete cascade;
create index transactions_entry_batch on public.transactions (entry_batch_id) where entry_batch_id is not null;

alter table public.entry_batches enable row level security;
create policy entry_batches_member_all on public.entry_batches for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
revoke all on public.entry_batches from authenticated;
grant select, insert, delete on public.entry_batches to authenticated;
revoke all on public.entry_batches from anon;

-- 이 기능 전에 한 번에 여러 건 저장한 거래(같은 순간·같은 사람, 시트 가져오기 제외)도 묶어서 되돌릴 수 있게 한다
with groups as (
  select household_id, created_at, created_by
  from public.transactions
  where import_batch_id is null
  group by household_id, created_at, created_by
  having count(*) >= 2
), batches as (
  insert into public.entry_batches (household_id, source, created_by, created_at)
  select household_id, 'earlier', created_by, created_at from groups
  returning id, household_id, created_by, created_at
)
update public.transactions t
set entry_batch_id = b.id
from batches b
where t.household_id = b.household_id
  and t.created_at = b.created_at
  and t.created_by is not distinct from b.created_by
  and t.import_batch_id is null;
