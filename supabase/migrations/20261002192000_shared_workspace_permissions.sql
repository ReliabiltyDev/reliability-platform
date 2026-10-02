-- Shared workspace permissions and personal workspace rules
create or replace function private.has_role(p_role app_role)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid()) and r.name = p_role
  );
$$;
grant execute on function private.has_role(app_role) to authenticated;

drop policy if exists notes_member_read on public.notes;
drop policy if exists notes_personal_read on public.notes;
drop policy if exists notes_personal_insert on public.notes;
drop policy if exists notes_personal_update on public.notes;
drop policy if exists notes_personal_delete on public.notes;
create policy notes_personal_read on public.notes for select to authenticated using (author_id = (select auth.uid()));
create policy notes_personal_insert on public.notes for insert to authenticated with check (author_id = (select auth.uid()));
create policy notes_personal_update on public.notes for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy notes_personal_delete on public.notes for delete to authenticated using (author_id = (select auth.uid()));

drop policy if exists visits_member_read on public.site_visits;
drop policy if exists visits_personal_read on public.site_visits;
drop policy if exists visits_personal_insert on public.site_visits;
drop policy if exists visits_personal_update on public.site_visits;
drop policy if exists visits_personal_delete on public.site_visits;
create policy visits_personal_read on public.site_visits for select to authenticated using (created_by = (select auth.uid()));
create policy visits_personal_insert on public.site_visits for insert to authenticated with check (created_by = (select auth.uid()) and private.is_site_member(site_id));
create policy visits_personal_update on public.site_visits for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()) and private.is_site_member(site_id));
create policy visits_personal_delete on public.site_visits for delete to authenticated using (created_by = (select auth.uid()));

create policy sites_admin_insert on public.sites for insert to authenticated with check (private.has_role('admin'));
create policy sites_admin_update on public.sites for update to authenticated using (private.has_role('admin')) with check (private.has_role('admin'));
create policy sites_admin_delete on public.sites for delete to authenticated using (private.has_role('admin'));

create policy areas_member_insert on public.areas for insert to authenticated with check (private.is_site_member(site_id));
create policy areas_member_update on public.areas for update to authenticated using (private.is_site_member(site_id)) with check (private.is_site_member(site_id));
create policy areas_member_delete on public.areas for delete to authenticated using (private.is_site_member(site_id));

create policy lines_member_insert on public.production_lines for insert to authenticated with check (exists (select 1 from public.areas a where a.id = area_id and private.is_site_member(a.site_id)));
create policy lines_member_update on public.production_lines for update to authenticated using (exists (select 1 from public.areas a where a.id = production_lines.area_id and private.is_site_member(a.site_id))) with check (exists (select 1 from public.areas a where a.id = production_lines.area_id and private.is_site_member(a.site_id)));
create policy lines_member_delete on public.production_lines for delete to authenticated using (exists (select 1 from public.areas a where a.id = production_lines.area_id and private.is_site_member(a.site_id)));

alter publication supabase_realtime add table public.assets;
alter publication supabase_realtime add table public.asset_photos;
