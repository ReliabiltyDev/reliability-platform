create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.bootstrap_demo_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  demo_site uuid;
  engineer_role bigint;
begin
  select id into demo_site from public.sites where code = 'DEMO-01' limit 1;
  if demo_site is null then
    raise exception 'Demo site is not configured';
  end if;

  select id into engineer_role from public.roles where name = 'engineer' limit 1;
  if engineer_role is null then
    raise exception 'Engineer role is not configured';
  end if;

  insert into public.site_memberships(user_id, site_id)
  values (auth.uid(), demo_site)
  on conflict do nothing;

  insert into public.user_roles(user_id, role_id)
  values (auth.uid(), engineer_role)
  on conflict do nothing;

  return jsonb_build_object('site_id', demo_site, 'role', 'engineer');
end;
$$;

revoke execute on function public.bootstrap_demo_workspace() from public, anon;
grant execute on function public.bootstrap_demo_workspace() to authenticated;
