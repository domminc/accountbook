-- 스키마 · RLS 테스트. scripts/test-db.sh 가 임시 Postgres에 migrations → 이 파일 순서로 실행한다.
-- 실패하면 예외로 중단된다.
\set ON_ERROR_STOP on

insert into public.users (id, login_id, password_hash) values
  ('00000000-0000-0000-0000-00000000000a', 'user_a', 'x'),
  ('00000000-0000-0000-0000-00000000000b', 'user_b', 'x');

-- 기대한 오류가 나는지 확인하는 도우미
create function pg_temp.expect_error(stmt text, label text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (오류가 나야 하는데 성공함)', label;
exception
  when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
end;
$$;

create function pg_temp.assert(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAIL: %', label;
  end if;
end;
$$;

grant execute on all functions in schema pg_temp to anon, authenticated;

-- ── 비로그인 사용자는 아무것도 못 본다 ──
set role anon;
select pg_temp.expect_error('select * from public.households', 'anon households 조회');
select pg_temp.expect_error($$select public.create_household('x', 'y')$$, 'anon 가구 생성');
reset role;

-- ── A: 가구 생성과 기본값 ──
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000a';
set role authenticated;

select pg_temp.expect_error($$insert into public.households (name) values ('직접')$$, '가구 직접 생성 차단');
select pg_temp.expect_error($$select password_hash from public.users$$, '로그인 사용자 역할로 users 조회 차단');
select pg_temp.expect_error(
  format($$select public.seed_household_defaults(%L)$$, '00000000-0000-0000-0000-000000000000'),
  '내부 함수 seed_household_defaults 직접 호출 차단');

select public.create_household('  우리집  ', '민수') as a_household \gset
select pg_temp.assert((select name from public.households) = '우리집', '가구 이름 trim');
select pg_temp.assert((select role from public.members) = 'owner', 'owner 역할');
select pg_temp.assert((select count(*) from public.category_groups) = 12, '대분류 12개');
select pg_temp.assert((select count(*) from public.categories) = 47, '소분류 47개');
select pg_temp.assert((select count(*) from public.payment_methods) = 2, '지출방법 2개');
select pg_temp.assert((select count(*) from public.tags) = 2, '태그 2개');
select pg_temp.assert(
  (select array_agg(kind::text order by sort_order) from public.category_groups where kind <> 'variable_expense')
    = array['income', 'saving', 'fixed_expense'],
  '수입·저축·고정지출 순서');

select pg_temp.expect_error($$select public.create_household('두번째', '민수')$$, '두 번째 가구 생성 차단');

-- 거래 입력
insert into public.transactions (household_id, occurred_on, amount, category_id, payment_method_id, memo, created_by)
select :'a_household', '2026-01-05', 12000,
  (select id from public.categories where name = '마트'),
  (select id from public.payment_methods where name = '체크카드'),
  '장보기', '00000000-0000-0000-0000-00000000000a';
select pg_temp.assert((select count(*) from public.transactions) = 1, '거래 입력');
select pg_temp.expect_error(
  format($$insert into public.transactions (household_id, occurred_on, amount) values (%L, '2026-01-05', 0)$$, :'a_household'),
  '금액 0 거절');

-- 시스템 대분류 보호
select pg_temp.expect_error($$delete from public.category_groups where name = '수입'$$, '수입 대분류 삭제 차단');
select pg_temp.expect_error($$update public.category_groups set name = '월수입' where name = '수입'$$, '수입 대분류 이름 변경 차단');
select pg_temp.expect_error($$update public.category_groups set kind = 'income' where name = '건강'$$, '비고정지출 종류 변경 차단');
select pg_temp.expect_error(
  format($$insert into public.category_groups (household_id, kind, name) values (%L, 'saving', '저축2')$$, :'a_household'),
  '저축 대분류 중복 차단');
update public.category_groups set sort_order = 99, is_hidden = true where name = '수입';
delete from public.category_groups where name = '자기계발';
select pg_temp.assert((select count(*) from public.category_groups) = 11, '비고정지출 대분류 삭제 허용');

-- 거래에서 쓰는 소분류는 지울 수 없다
select pg_temp.expect_error($$delete from public.categories where name = '마트'$$, '사용 중 소분류 삭제 차단');

-- 역할 변경 불가, 표시 이름은 변경 가능
select pg_temp.expect_error($$update public.members set role = 'member'$$, '역할 변경 차단');
update public.members set display_name = '민수2';
select pg_temp.assert((select display_name from public.members) = '민수2', '표시 이름 변경');

reset role;

-- ── B: 다른 가구 데이터 격리 ──
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000b';
set role authenticated;

select pg_temp.assert((select count(*) from public.households) = 0, 'B는 A 가구를 못 봄');
select pg_temp.assert((select count(*) from public.transactions) = 0, 'B는 A 거래를 못 봄');
select pg_temp.assert((select count(*) from public.categories) = 0, 'B는 A 소분류를 못 봄');

select pg_temp.expect_error(
  format($$insert into public.transactions (household_id, occurred_on, amount) values (%L, '2026-01-05', 1000)$$, :'a_household'),
  'B가 A 가구에 거래 입력 차단');
select pg_temp.expect_error(
  format($$insert into public.members (household_id, user_id, role, display_name) values (%L, '00000000-0000-0000-0000-00000000000b', 'member', '침입')$$, :'a_household'),
  'B가 A 가구에 스스로 참여 차단');

update public.transactions set amount = 1;
update public.households set name = '해킹';
reset role;
select pg_temp.assert((select amount from public.transactions) = 12000, 'B 수정 무효');
select pg_temp.assert((select name from public.households) = '우리집', 'B 가구 이름 수정 무효');

-- B가 자기 가구를 만들어도 A의 소분류를 참조할 수 없다 (복합 FK)
select id as a_mart from public.categories where name = '마트' \gset
set role authenticated;
select public.create_household('B네', '지영') as b_household \gset
select pg_temp.expect_error(
  format($$insert into public.transactions (household_id, occurred_on, amount, category_id) values (%L, '2026-01-05', 1000, %L)$$,
         :'b_household', :'a_mart'),
  'B 거래가 A 소분류 참조 차단');
select pg_temp.assert((select count(*) from public.households) = 1, 'B는 자기 가구만 봄');
reset role;

-- ── 초대: 만들기·보기는 구성원만, 수락은 RPC로, 한 번만 ──
insert into public.users (id, login_id, password_hash) values
  ('00000000-0000-0000-0000-00000000000c', 'user_c', 'x');

set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000a';
set role authenticated;
insert into public.household_invites (household_id, token_hash, created_by, expires_at)
values (:'a_household', public.invite_token_hash('tok-valid'), '00000000-0000-0000-0000-00000000000a', now() + interval '7 days'),
       (:'a_household', public.invite_token_hash('tok-expired'), '00000000-0000-0000-0000-00000000000a', now() - interval '1 minute');
select pg_temp.assert((select count(*) from public.household_invites) = 2, 'A는 자기 초대를 봄');
select pg_temp.expect_error($$update public.household_invites set used_at = now()$$, '초대 직접 수정 차단');
reset role;

-- B는 이미 자기 가계부가 있어 참여할 수 없고, A의 초대도 못 본다
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.assert((select count(*) from public.household_invites) = 0, 'B는 A 초대를 못 봄');
select pg_temp.expect_error(
  format($$insert into public.household_invites (household_id, token_hash, expires_at) values (%L, 'x', now())$$, :'a_household'),
  'B가 A 가구 초대 생성 차단');
select pg_temp.expect_error($$select public.accept_invite('tok-valid', 'B')$$, '이미 가구가 있는 사용자 참여 차단');
reset role;

-- C: 만료된 링크는 거절, 유효한 링크로 참여
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000c';
set role authenticated;
select pg_temp.assert((select status from public.invite_info('tok-valid')) = 'valid', '초대 정보 조회');
select pg_temp.assert((select status from public.invite_info('tok-expired')) = 'expired', '만료 초대 표시');
select pg_temp.assert((select count(*) from public.invite_info('nope')) = 0, '없는 초대');
select pg_temp.expect_error($$select public.accept_invite('tok-expired', 'C')$$, '만료 초대 거절');
select pg_temp.assert(public.accept_invite('tok-valid', ' 지영 ') = :'a_household', '초대 수락');
select pg_temp.assert((select count(*) from public.transactions) = 1, 'C는 A 가구 거래를 봄');
select pg_temp.assert((select role::text from public.members where user_id = '00000000-0000-0000-0000-00000000000c') = 'member', 'C는 member');
select pg_temp.assert((select display_name from public.members where user_id = '00000000-0000-0000-0000-00000000000c') = '지영', '이름 trim');
reset role;

-- 쓴 초대는 다시 쓸 수 없다
insert into public.users (id, login_id, password_hash) values ('00000000-0000-0000-0000-00000000000d', 'user_d', 'x');
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000d';
set role authenticated;
select pg_temp.assert((select status from public.invite_info('tok-valid')) = 'used', '사용한 초대 표시');
select pg_temp.expect_error($$select public.accept_invite('tok-valid', 'D')$$, '사용한 초대 거절');
reset role;

-- ── 2차: 자산·대출·결제일도 가구 단위로 격리 ──
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000a';
set role authenticated;
insert into public.loans (household_id, name, principal) values (:'a_household', '주택담보', 100000000);
insert into public.loan_repayments (household_id, loan_id, paid_on, principal, interest)
select :'a_household', id, '2026-01-07', 1000000, 300000 from public.loans;
insert into public.bank_accounts (household_id, bank, account_last4) values (:'a_household', '국민', '1234');
select pg_temp.expect_error(
  format($$insert into public.bank_accounts (household_id, bank, account_last4) values (%L, '국민', '123-456')$$, :'a_household'),
  '계좌번호는 끝 4자리 숫자만');
insert into public.recurring_payments (household_id, content, amount, pay_day, category_id)
select :'a_household', '통신비', 55000, 25, id from public.categories where name = '통신비';
reset role;

select id as a_loan from public.loans \gset

set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.assert((select count(*) from public.loans) = 0, 'B는 A 대출을 못 봄');
select pg_temp.assert((select count(*) from public.recurring_payments) = 0, 'B는 A 결제일을 못 봄');
select pg_temp.expect_error(
  format($$insert into public.loan_repayments (household_id, loan_id, paid_on) values (%L, %L, '2026-01-01')$$, :'b_household', :'a_loan'),
  'B 가구에서 A 대출 참조 차단 (복합 FK)');
select pg_temp.expect_error(
  format($$insert into public.loan_repayments (household_id, loan_id, paid_on) values (%L, %L, '2026-01-01')$$, :'a_household', :'a_loan'),
  'B가 A 가구에 상환 기록 차단 (RLS)');
reset role;

-- 카드 ↔ 지출방법: 같은 가구의 지출방법만, 한 지출방법은 카드 하나에만
select id as a_check from public.payment_methods where household_id = :'a_household' and name = '체크카드' \gset
select id as b_check from public.payment_methods where household_id = :'b_household' and name = '체크카드' \gset
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000a';
set role authenticated;
insert into public.cards (household_id, name, monthly_budget, payment_method_id) values (:'a_household', '생활비카드', 800000, :'a_check');
select pg_temp.expect_error(
  format($$insert into public.cards (household_id, name, payment_method_id) values (%L, '다른카드', %L)$$, :'a_household', :'a_check'),
  '한 지출방법은 카드 하나에만 연결');
select pg_temp.expect_error(
  format($$insert into public.cards (household_id, name, payment_method_id) values (%L, '남의카드', %L)$$, :'a_household', :'b_check'),
  'B 가구 지출방법 연결 차단 (복합 FK)');
insert into public.payment_methods (household_id, name, sort_order) values (:'a_household', '현대카드', 9);
update public.cards set payment_method_id = (select id from public.payment_methods where name = '현대카드')
where name = '생활비카드';
delete from public.payment_methods where name = '현대카드';
select pg_temp.assert(
  (select payment_method_id is null and monthly_budget = 800000 from public.cards where name = '생활비카드'),
  '지출방법 삭제 시 카드는 남고 연결만 끊김');
reset role;

-- 과소비 한도: 소분류 또는 태그 하나, 같은 가구만, 항목당 하나, 소분류를 지우면 같이 지움
select id as a_regret from public.tags where household_id = :'a_household' and name = '반성' \gset
select id as b_regret from public.tags where household_id = :'b_household' and name = '반성' \gset
select id as a_cafe from public.categories where household_id = :'a_household' and name = '카페' \gset
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000a';
set role authenticated;
insert into public.spending_limits (household_id, category_id, amount) values (:'a_household', :'a_cafe', 100000);
insert into public.spending_limits (household_id, tag_id, amount) values (:'a_household', :'a_regret', 50000);
select pg_temp.expect_error(
  format($$insert into public.spending_limits (household_id, category_id, amount) values (%L, %L, 1)$$, :'a_household', :'a_cafe'),
  '항목당 한도 하나');
select pg_temp.expect_error(
  format($$insert into public.spending_limits (household_id, category_id, tag_id, amount) values (%L, %L, %L, 1)$$, :'a_household', :'a_mart', :'a_regret'),
  '소분류와 태그를 함께 지정 차단');
select pg_temp.expect_error(
  format($$insert into public.spending_limits (household_id, tag_id, amount) values (%L, %L, 1)$$, :'a_household', :'b_regret'),
  'B 가구 태그 한도 차단 (복합 FK)');
reset role;
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.assert((select count(*) from public.spending_limits) = 0, 'B는 A 한도를 못 봄');
reset role;
delete from public.categories where id = :'a_cafe';
select pg_temp.assert(
  (select count(*) from public.spending_limits where household_id = :'a_household') = 1, '소분류 삭제 시 그 한도도 삭제');

-- 영수증: 같은 가구 거래에만, 구성원만 보고, 거래를 지우면 같이 지움, 이미지 형식만
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000a';
set role authenticated;
insert into public.transactions (household_id, occurred_on, amount, category_id, memo, created_by)
select :'a_household', '2026-02-01', 3000, :'a_mart', '영수증 테스트', '00000000-0000-0000-0000-00000000000a';
select id as a_receipt_tx from public.transactions where memo = '영수증 테스트' \gset
insert into public.transaction_receipts (household_id, transaction_id, content_type, data)
values (:'a_household', :'a_receipt_tx', 'image/jpeg', '\xffd8ffe0'::bytea);
select pg_temp.expect_error(
  format($$insert into public.transaction_receipts (household_id, transaction_id, content_type, data) values (%L, %L, 'image/svg+xml', '\x3c'::bytea)$$, :'a_household', :'a_receipt_tx'),
  '영수증은 이미지 형식만');
reset role;
set request.jwt.claim.sub to '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.assert((select count(*) from public.transaction_receipts) = 0, 'B는 A 영수증을 못 봄');
select pg_temp.expect_error(
  format($$insert into public.transaction_receipts (household_id, transaction_id, content_type, data) values (%L, %L, 'image/jpeg', '\xffd8ff'::bytea)$$, :'b_household', :'a_receipt_tx'),
  'B 가구에서 A 거래에 영수증 차단 (복합 FK)');
reset role;
delete from public.transactions where id = :'a_receipt_tx';
select pg_temp.assert(
  (select count(*) from public.transaction_receipts where transaction_id = :'a_receipt_tx') = 0, '거래 삭제 시 영수증도 삭제');

-- 결제일에 연결된 소분류를 지우면 결제일은 남고 구분만 비워진다
delete from public.categories where name = '통신비' and household_id = :'a_household';
select pg_temp.assert(
  (select category_id is null and household_id = :'a_household' from public.recurring_payments where content = '통신비'),
  '소분류 삭제 시 결제일 구분만 null');

-- ── 가구 삭제는 cascade로 전부 지운다 ──
delete from public.households where id = :'a_household';
select pg_temp.assert(
  (select count(*) from public.category_groups where household_id = :'a_household') = 0, 'A 가구 cascade 삭제');
select pg_temp.assert((select count(*) from public.transactions) = 0, 'A 거래 cascade 삭제');

\echo 'OK: 모든 DB 테스트 통과'
