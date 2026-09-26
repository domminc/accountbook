-- 과소비 알림: 소분류 또는 태그별 매월 한도. 한 항목에 하나만.
-- 소분류·태그를 지우면 한도도 지운다.
create table public.spending_limits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid,
  tag_id uuid,
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  created_at timestamptz not null default now(),
  constraint spending_limits_one_target check ((category_id is null) <> (tag_id is null)),
  constraint spending_limits_category_unique unique (household_id, category_id),
  constraint spending_limits_tag_unique unique (household_id, tag_id),
  foreign key (category_id, household_id) references public.categories (id, household_id) on delete cascade,
  foreign key (tag_id, household_id) references public.tags (id, household_id) on delete cascade
);

alter table public.spending_limits enable row level security;
create policy spending_limits_member_all on public.spending_limits for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
grant select, insert, update, delete on public.spending_limits to authenticated;
revoke all on public.spending_limits from anon;
