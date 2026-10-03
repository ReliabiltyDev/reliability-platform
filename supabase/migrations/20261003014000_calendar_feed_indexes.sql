create index if not exists site_visits_site_id_idx on public.site_visits (site_id);
create index if not exists site_visits_asset_id_idx on public.site_visits (asset_id);
create index if not exists asset_condition_readings_visit_id_idx on public.asset_condition_readings (visit_id);
create index if not exists asset_condition_readings_recorded_by_idx on public.asset_condition_readings (recorded_by);