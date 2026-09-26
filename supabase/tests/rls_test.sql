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

-- ── 가구 삭제는 cascade로 전부 지운다 ──
delete from public.households where id = :'a_household';
select pg_temp.assert(
  (select count(*) from public.category_groups where household_id = :'a_household') = 0, 'A 가구 cascade 삭제');
select pg_temp.assert((select count(*) from public.transactions) = 0, 'A 거래 cascade 삭제');

\echo 'OK: 모든 DB 테스트 통과'
