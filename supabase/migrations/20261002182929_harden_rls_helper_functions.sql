create schema if not exists private;
alter function public.is_site_member(uuid) set schema private;
alter function public.asset_site_id(uuid) set schema private;

grant usage on schema private to authenticated;
grant execute on function private.is_site_member(uuid) to authenticated;
grant execute on function private.asset_site_id(uuid) to authenticated;

grant select, insert on public.site_memberships to authenticated;
drop policy if exists site_memberships_self_insert on public.site_memberships;
create policy site_memberships_self_insert on public.site_memberships
for insert to authenticated
with check (user_id=auth.uid());

grant select, insert on public.user_roles to authenticated;
drop policy if exists user_roles_self_insert on public.user_roles;
create policy user_roles_self_insert on public.user_roles
for insert to authenticated
with check (user_id=auth.uid());

alter function public.bootstrap_demo_workspace() security invoker;

