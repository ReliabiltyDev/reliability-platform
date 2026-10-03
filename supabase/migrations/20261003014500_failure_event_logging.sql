drop policy if exists failure_events_member_insert on public.failure_events;
create policy failure_events_member_insert on public.failure_events
  for insert to authenticated
  with check (
    reported_by = (select auth.uid())
    and private.is_site_member(private.asset_site_id(asset_id))
  );