
alter table public.assets add column if not exists site_id uuid;

update public.assets a
set site_id = s.id
from public.production_lines pl
join public.areas ar on ar.id = pl.area_id
join public.sites s on s.id = ar.site_id
where a.production_line_id = pl.id
  and a.site_id is null;

update public.assets a
set site_id = p.site_id
from public.assets p
where a.parent_asset_id = p.id
  and a.site_id is null;

do $$
begin
  if exists (select 1 from public.assets where site_id is null) then
    raise exception 'Cannot enforce asset site assignment: one or more assets have no site';
  end if;
end $$;

alter table public.assets
  alter column site_id set not null;

alter table public.assets
  add constraint assets_site_id_fkey
  foreign key (site_id) references public.sites(id) on delete restrict;

create index if not exists idx_assets_site_id on public.assets(site_id);

create or replace function private.asset_site_id(p_asset_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select a.site_id
  from public.assets a
  where a.id = p_asset_id
$$;

create or replace function private.validate_asset_site()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  line_site uuid;
  parent_site uuid;
begin
  if new.production_line_id is not null then
    select ar.site_id into line_site
    from public.production_lines pl
    join public.areas ar on ar.id = pl.area_id
    where pl.id = new.production_line_id;

    if line_site is null or line_site <> new.site_id then
      raise exception 'Asset site must match its production line site';
    end if;
  end if;

  if new.parent_asset_id is not null then
    select a.site_id into parent_site
    from public.assets a
    where a.id = new.parent_asset_id;

    if parent_site is null or parent_site <> new.site_id then
      raise exception 'Asset site must match its parent asset site';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_asset_site on public.assets;
create trigger trg_validate_asset_site
before insert or update of site_id, production_line_id, parent_asset_id
on public.assets
for each row execute function private.validate_asset_site();

drop policy if exists assets_member_insert on public.assets;
create policy assets_member_insert on public.assets
for insert to authenticated
with check (private.is_site_member(site_id));

drop policy if exists assets_member_update on public.assets;
create policy assets_member_update on public.assets
for update to authenticated
using (private.is_site_member(site_id))
with check (private.is_site_member(site_id));

drop policy if exists assets_member_read on public.assets;
create policy assets_member_read on public.assets
for select to authenticated
using (private.is_site_member(site_id));

drop policy if exists assets_member_delete on public.assets;
create policy assets_member_delete on public.assets
for delete to authenticated
using (private.is_site_member(site_id));

