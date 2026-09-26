-- 가계부 기본 스키마 (MVP)
-- 모든 데이터는 가구(households) 단위로 격리된다. RLS는 is_household_member()로 판단한다.
-- 금액은 원 단위 정수(bigint)로 저장한다.

-- ─────────────────────────────────────────────
-- 타입
-- ─────────────────────────────────────────────
create type public.category_kind as enum ('income', 'saving', 'fixed_expense', 'variable_expense');
create type public.goal_kind as enum ('income', 'saving', 'expense');
create type public.member_role as enum ('owner', 'member');
create type public.reserve_direction as enum ('in', 'out');

-- ─────────────────────────────────────────────
-- 가구 · 구성원
-- ─────────────────────────────────────────────
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 50),
  created_at timestamptz not null default now()
);

create table public.members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  display_name text not null check (length(trim(display_name)) between 1 and 30),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- 한 사용자는 가계부 하나에만 속한다 (부부 2인 공유)
create unique index members_one_household_per_user on public.members (user_id);

-- ─────────────────────────────────────────────
-- 설정: 대분류 · 소분류 · 지출방법 · 태그
-- ─────────────────────────────────────────────
create table public.category_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.category_kind not null,
  name text not null check (length(trim(name)) between 1 and 30),
  sort_order int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);

-- 수입 · 저축 · 고정지출 대분류는 가구마다 정확히 하나 (시트 규칙: 설정 B6~B8 고정)
create unique index category_groups_one_system_group
  on public.category_groups (household_id, kind)
  where kind <> 'variable_expense';

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  group_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 30),
  sort_order int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (group_id, name),
  unique (id, household_id),
  foreign key (group_id, household_id)
    references public.category_groups (id, household_id) on delete cascade
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 30),
  sort_order int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 30),
  sort_order int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);

-- ─────────────────────────────────────────────
-- 거래
-- ─────────────────────────────────────────────
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  file_name text not null,
  year int not null,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  occurred_on date not null,
  amount bigint not null check (amount > 0),
  -- 가져온 미분류 거래만 null. 직접 입력은 앱에서 필수로 검사한다.
  category_id uuid,
  payment_method_id uuid,
  memo text check (memo is null or length(memo) <= 200),
  import_batch_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  -- 다른 가구의 카테고리·지출방법·가져오기 배치를 가리킬 수 없게 복합 FK로 묶는다
  foreign key (category_id, household_id)
    references public.categories (id, household_id) on delete restrict,
  foreign key (payment_method_id, household_id)
    references public.payment_methods (id, household_id) on delete restrict,
  foreign key (import_batch_id, household_id)
    references public.import_batches (id, household_id) on delete cascade
);

create index transactions_household_date on public.transactions (household_id, occurred_on);

create table public.transaction_tags (
  transaction_id uuid not null,
  tag_id uuid not null,
  household_id uuid not null,
  primary key (transaction_id, tag_id),
  foreign key (transaction_id, household_id)
    references public.transactions (id, household_id) on delete cascade,
  foreign key (tag_id, household_id)
    references public.tags (id, household_id) on delete cascade
);

-- ─────────────────────────────────────────────
-- 예산 · 목표 · 이달의 이벤트
-- ─────────────────────────────────────────────
-- period는 그 달 1일 (예: 2026-01-01)
create table public.budgets (
  household_id uuid not null,
  period date not null check (extract(day from period) = 1),
  group_id uuid not null,
  amount bigint not null check (amount >= 0),
  primary key (household_id, period, group_id),
  foreign key (group_id, household_id)
    references public.category_groups (id, household_id) on delete cascade
);

create table public.goals (
  household_id uuid not null references public.households (id) on delete cascade,
  period date not null check (extract(day from period) = 1),
  kind public.goal_kind not null,
  amount bigint not null default 0 check (amount >= 0),
  note text check (note is null or length(note) <= 500),
  primary key (household_id, period, kind)
);

create table public.month_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  occurred_on date not null,
  budget bigint check (budget is null or budget >= 0),
  content text not null check (length(content) <= 200),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 예비비
-- ─────────────────────────────────────────────
create table public.reserve_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 30),
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);

create table public.reserve_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  direction public.reserve_direction not null,
  occurred_on date not null,
  amount bigint not null check (amount > 0),
  reserve_category_id uuid not null,
  memo text check (memo is null or length(memo) <= 200),
  note text check (note is null or length(note) <= 200),
  import_batch_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (reserve_category_id, household_id)
    references public.reserve_categories (id, household_id) on delete restrict,
  foreign key (import_batch_id, household_id)
    references public.import_batches (id, household_id) on delete cascade
);

create index reserve_entries_household_date on public.reserve_entries (household_id, occurred_on);

-- ─────────────────────────────────────────────
-- 트리거
-- ─────────────────────────────────────────────
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- 수입 · 저축 · 고정지출 대분류는 삭제하거나 이름 · 종류를 바꿀 수 없다.
-- 가구 자체를 지울 때(cascade)는 허용한다.
create function public.protect_system_category_groups() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.kind <> 'variable_expense'
       and exists (select 1 from public.households where id = old.household_id) then
      raise exception '"%" 대분류는 삭제할 수 없습니다.', old.name using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.kind <> 'variable_expense' and (new.name <> old.name or new.kind <> old.kind) then
    raise exception '"%" 대분류는 이름이나 종류를 바꿀 수 없습니다.', old.name using errcode = 'check_violation';
  end if;
  if old.kind = 'variable_expense' and new.kind <> 'variable_expense' then
    raise exception '대분류 종류는 바꿀 수 없습니다.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger category_groups_protect_system
  before update or delete on public.category_groups
  for each row execute function public.protect_system_category_groups();

-- ─────────────────────────────────────────────
-- 권한 판단 함수
-- ─────────────────────────────────────────────
create function public.is_household_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members
    where household_id = target and user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.category_groups enable row level security;
alter table public.categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.tags enable row level security;
alter table public.import_batches enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_tags enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.month_events enable row level security;
alter table public.reserve_categories enable row level security;
alter table public.reserve_entries enable row level security;

-- 가구: 구성원만 조회·이름 변경. 생성은 create_household()로만.
create policy households_select on public.households
  for select to authenticated using (public.is_household_member(id));
create policy households_update on public.households
  for update to authenticated using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- 구성원: 같은 가구 구성원끼리 조회, 자기 표시 이름만 수정. 추가는 RPC로만.
create policy members_select on public.members
  for select to authenticated using (public.is_household_member(household_id));
create policy members_update_self on public.members
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 나머지 가구 데이터: 구성원이면 읽고 쓸 수 있다.
do $$
declare
  t text;
begin
  foreach t in array array[
    'category_groups', 'categories', 'payment_methods', 'tags', 'import_batches',
    'transactions', 'transaction_tags', 'budgets', 'goals', 'month_events',
    'reserve_categories', 'reserve_entries'
  ] loop
    execute format(
      'create policy %1$s_member_all on public.%1$I for all to authenticated
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))',
      t
    );
  end loop;
end;
$$;

-- 테이블 권한: 로그인 사용자만 (행 단위 제한은 위 RLS). 비로그인(anon)은 접근 불가.
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- 구성원 역할 변경 방지: 표시 이름 외 컬럼은 수정 불가
revoke update on public.members from authenticated;
grant update (display_name) on public.members to authenticated;

-- ─────────────────────────────────────────────
-- 새 가구 기본값 (참고 시트 기반, 개인 항목 제외)
-- ─────────────────────────────────────────────
create function public.seed_household_defaults(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  defaults jsonb := '[
    {"kind": "income",           "name": "수입",       "subs": ["월급", "부수입", "수당", "이월"]},
    {"kind": "saving",           "name": "저축",       "subs": ["적금", "ISA", "연금", "IRP"]},
    {"kind": "fixed_expense",    "name": "고정지출",   "subs": ["주거비", "보험료", "통신비", "가스비", "관리비", "렌탈비", "교통비"]},
    {"kind": "variable_expense", "name": "식비",       "subs": ["마트", "편의점", "외식", "배달", "카페"]},
    {"kind": "variable_expense", "name": "용돈",       "subs": ["주유비", "톨비", "점심식대"]},
    {"kind": "variable_expense", "name": "생활용품",   "subs": ["생필품/소모품", "수리비", "주방/욕실"]},
    {"kind": "variable_expense", "name": "의복/미용",  "subs": ["의류", "화장품", "헤어"]},
    {"kind": "variable_expense", "name": "육아비",     "subs": ["의류", "기저귀", "소모품", "보육료"]},
    {"kind": "variable_expense", "name": "건강",       "subs": ["병원", "약국", "영양제"]},
    {"kind": "variable_expense", "name": "자기계발",   "subs": ["강의", "책", "응시료 등"]},
    {"kind": "variable_expense", "name": "경조사",     "subs": ["가족", "지인", "회사", "상조"]},
    {"kind": "variable_expense", "name": "기타",       "subs": ["자동차세", "지방세", "차수리비", "기타"]}
  ]'::jsonb;
  g jsonb;
  g_idx int := 0;
  s_idx int;
  new_group uuid;
  sub text;
begin
  for g in select * from jsonb_array_elements(defaults) loop
    insert into public.category_groups (household_id, kind, name, sort_order)
    values (target, (g->>'kind')::public.category_kind, g->>'name', g_idx)
    returning id into new_group;

    s_idx := 0;
    for sub in select * from jsonb_array_elements_text(g->'subs') loop
      insert into public.categories (household_id, group_id, name, sort_order)
      values (target, new_group, sub, s_idx);
      s_idx := s_idx + 1;
    end loop;

    g_idx := g_idx + 1;
  end loop;

  insert into public.payment_methods (household_id, name, sort_order)
  values (target, '체크카드', 0), (target, '현금', 1);

  insert into public.tags (household_id, name, sort_order)
  values (target, '반성', 0), (target, '확인필요', 1);
end;
$$;

revoke all on function public.seed_household_defaults(uuid) from public;

-- 로그인한 사용자가 새 가구를 만들고 owner가 된다. 이미 가구가 있으면 거절.
create function public.create_household(household_name text, member_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.members where user_id = uid) then
    raise exception '이미 참여 중인 가계부가 있습니다.' using errcode = 'unique_violation';
  end if;

  insert into public.households (name) values (trim(household_name)) returning id into new_id;
  insert into public.members (household_id, user_id, role, display_name)
  values (new_id, uid, 'owner', trim(member_name));
  perform public.seed_household_defaults(new_id);
  return new_id;
end;
$$;

revoke all on function public.create_household(text, text) from public;
grant execute on function public.create_household(text, text) to authenticated;
