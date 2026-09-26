-- 카드 ↔ 지출방법 연결: 카드의 매월 예산을 그 지출방법으로 쓴 지출과 비교한다.
-- 지출방법을 지우면 카드는 남고 연결만 끊긴다. 한 지출방법은 카드 하나에만 연결한다 (지출이 두 카드에 겹쳐 잡히지 않게).
alter table public.cards add column payment_method_id uuid;
alter table public.cards
  add constraint cards_payment_method_fk
  foreign key (payment_method_id, household_id)
  references public.payment_methods (id, household_id) on delete set null (payment_method_id);
create unique index cards_payment_method_unique on public.cards (household_id, payment_method_id)
  where payment_method_id is not null;
