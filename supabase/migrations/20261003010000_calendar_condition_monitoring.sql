alter table public.site_visits
  add column if not exists asset_id uuid references public.assets(id) on delete set null,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists all_day boolean not null default true,
  add column if not exists location text;

alter table public.site_visits
  drop constraint if exists site_visits_schedule_order_check;
alter table public.site_visits
  add constraint site_visits_schedule_order_check
  check (scheduled_start is null or scheduled_end is null or scheduled_end >= scheduled_start);

drop policy if exists visits_personal_insert on public.site_visits;
drop policy if exists visits_personal_update on public.site_visits;
create policy visits_personal_insert on public.site_visits for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_site_member(site_id)
    and (asset_id is null or private.asset_site_id(asset_id) = site_id)
  );
create policy visits_personal_update on public.site_visits for update to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and private.is_site_member(site_id)
    and (asset_id is null or private.asset_site_id(asset_id) = site_id)
  );

create table if not exists public.asset_condition_readings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  visit_id uuid references public.site_visits(id) on delete set null,
  observed_at timestamptz not null default now(),
  measure_name text not null check (length(trim(measure_name)) between 1 and 120),
  value numeric not null,
  unit text not null default '',
  potential_failure_threshold numeric,
  functional_failure_threshold numeric,
  higher_is_worse boolean not null default true,
  source text,
  notes text,
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint condition_thresholds_distinct check (
    potential_failure_threshold is null
    or functional_failure_threshold is null
    or potential_failure_threshold <> functional_failure_threshold
  )
);

create index if not exists asset_condition_readings_asset_measure_date_idx
  on public.asset_condition_readings (asset_id, measure_name, observed_at desc);
create index if not exists asset_condition_readings_site_date_idx
  on public.asset_condition_readings (site_id, observed_at desc);
create index if not exists site_visits_schedule_idx
  on public.site_visits (created_by, scheduled_start, visit_date);

alter table public.asset_condition_readings enable row level security;
grant select, insert, update, delete on public.asset_condition_readings to authenticated;

drop policy if exists condition_readings_member_read on public.asset_condition_readings;
drop policy if exists condition_readings_member_insert on public.asset_condition_readings;
drop policy if exists condition_readings_member_update on public.asset_condition_readings;
drop policy if exists condition_readings_member_delete on public.asset_condition_readings;
create policy condition_readings_member_read on public.asset_condition_readings for select to authenticated
  using (private.is_site_member(site_id));
create policy condition_readings_member_insert on public.asset_condition_readings for insert to authenticated
  with check (
    private.is_site_member(site_id)
    and private.asset_site_id(asset_id) = site_id
    and recorded_by = (select auth.uid())
    and (
      visit_id is null
      or exists (
        select 1 from public.site_visits v
        where v.id = asset_condition_readings.visit_id
          and v.site_id = asset_condition_readings.site_id
          and v.asset_id = asset_condition_readings.asset_id
          and v.created_by = (select auth.uid())
      )
    )
  );
create policy condition_readings_member_update on public.asset_condition_readings for update to authenticated
  using (private.is_site_member(site_id))
  with check (
    private.is_site_member(site_id)
    and private.asset_site_id(asset_id) = site_id
    and recorded_by = (select auth.uid())
    and (
      visit_id is null
      or exists (
        select 1 from public.site_visits v
        where v.id = asset_condition_readings.visit_id
          and v.site_id = asset_condition_readings.site_id
          and v.asset_id = asset_condition_readings.asset_id
          and v.created_by = (select auth.uid())
      )
    )
  );
create policy condition_readings_member_delete on public.asset_condition_readings for delete to authenticated
  using (private.is_site_member(site_id));

alter publication supabase_realtime add table public.asset_condition_readings;