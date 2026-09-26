-- 시트 가져오기로 들어온 이달의 이벤트도 가져오기 배치에 묶어, 같은 연도를 다시 가져올 때 함께 지운다.
alter table public.month_events add column import_batch_id uuid;
alter table public.month_events
  add constraint month_events_import_batch_fk
  foreign key (import_batch_id, household_id)
  references public.import_batches (id, household_id) on delete cascade;

-- 같은 연도 가져오기 배치를 찾을 때 쓰는 인덱스
create index import_batches_household_year on public.import_batches (household_id, year);
