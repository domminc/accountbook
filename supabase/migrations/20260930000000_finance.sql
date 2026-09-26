-- 2차: 자산관리 · 대출 관리 · 카드 관리 · 통장관리 · 결제일 관리 (참고 시트의 같은 이름 탭)

create type public.asset_section as enum ('liability', 'non_current', 'current');

-- 자산 항목 (예: 비유동자산 > 부동산 > A 아파트 시세)
create table public.asset_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  section public.asset_section not null,
  group_name text not null check (length(trim(group_name)) between 1 and 30),
  name text not null check (length(trim(name)) between 1 and 50),
  sort_order int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);

-- 항목별 월말 금액
create table public.asset_snapshots (
  asset_item_id uuid not null,
  household_id uuid not null,
  period date not null check (extract(day from period) = 1),
  amount bigint not null check (amount >= 0 and amount <= 1000000000000),
  primary key (asset_item_id, period),
  foreign key (asset_item_id, household_id) references public.asset_items (id, household_id) on delete cascade
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  lender text,
  name text not null check (length(trim(name)) between 1 and 50),
  purpose text,
  principal bigint not null check (principal >= 0 and principal <= 1000000000000),
  rate_percent numeric(6, 3) check (rate_percent is null or rate_percent between 0 and 100),
  payment_day text,
  monthly_payment bigint check (monthly_payment is null or monthly_payment >= 0),
  rate_type text,
  term text,
  repayment_terms text,
  repayment_method text,
  prepayment_fee_percent numeric(6, 3) check (prepayment_fee_percent is null or prepayment_fee_percent between 0 and 100),
  preferential_rate text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);

-- 대출 상환 기록 → 원금잔액·누적이자 계산
create table public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  loan_id uuid not null,
  paid_on date not null,
  principal bigint not null default 0 check (principal >= 0),
  interest bigint not null default 0 check (interest >= 0),
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now(),
  foreign key (loan_id, household_id) references public.loans (id, household_id) on delete cascade
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  issuer text,
  name text not null check (length(trim(name)) between 1 and 50),
  card_type text,
  purpose text,
  monthly_budget bigint check (monthly_budget is null or monthly_budget >= 0),
  valid_until text,
  annual_fee bigint check (annual_fee is null or annual_fee >= 0),
  usage_period text,
  billing_day text,
  billing_account text,
  credit_limit bigint check (credit_limit is null or credit_limit >= 0),
  performance_amount bigint check (performance_amount is null or performance_amount >= 0),
  benefits text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 통장 목록. 계좌번호는 끝 4자리만 저장한다.
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  bank text not null check (length(trim(bank)) between 1 and 30),
  account_type text,
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9]{1,4}$'),
  holder text,
  purpose text,
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 결제일 관리: 매달 나가는 돈. 이번 달 거래로 만들 때 recurring_payment_id 로 연결한다.
create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 50),
  category_id uuid,
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  pay_day int not null check (pay_day between 1 and 31),
  payment_method_id uuid,
  account_note text,
  note text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (category_id, household_id) references public.categories (id, household_id) on delete set null (category_id),
  foreign key (payment_method_id, household_id) references public.payment_methods (id, household_id) on delete set null (payment_method_id)
);

alter table public.transactions add column recurring_payment_id uuid;
alter table public.transactions
  add constraint transactions_recurring_payment_fk
  foreign key (recurring_payment_id, household_id)
  references public.recurring_payments (id, household_id) on delete set null (recurring_payment_id);
create index transactions_recurring_payment on public.transactions (recurring_payment_id) where recurring_payment_id is not null;

-- RLS: 구성원만
do $$
declare
  t text;
begin
  foreach t in array array['asset_items', 'asset_snapshots', 'loans', 'loan_repayments', 'cards', 'bank_accounts', 'recurring_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %1$s_member_all on public.%1$I for all to authenticated
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;
