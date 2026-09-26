-- 영수증 사진: 브라우저에서 줄인 이미지(JPEG·PNG·WebP)를 DB에 그대로 둔다. 거래를 지우면 같이 지운다.
-- 거래 목록을 가볍게 두려고 거래 표와 따로 둔다. 수정은 없고 추가·삭제만.
create table public.transaction_receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  transaction_id uuid not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  data bytea not null check (octet_length(data) between 1 and 1572864),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (transaction_id, household_id) references public.transactions (id, household_id) on delete cascade
);
create index transaction_receipts_transaction on public.transaction_receipts (transaction_id);

alter table public.transaction_receipts enable row level security;
create policy transaction_receipts_member_all on public.transaction_receipts for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
grant select, insert, delete on public.transaction_receipts to authenticated;
revoke all on public.transaction_receipts from anon;
