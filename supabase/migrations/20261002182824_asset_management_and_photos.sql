create table if not exists public.asset_photos (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  storage_path text not null unique,
  caption text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists asset_photos_asset_idx on public.asset_photos(asset_id);

alter table public.asset_photos enable row level security;

grant select, insert, update, delete on public.asset_photos to authenticated;

drop policy if exists asset_photos_member_read on public.asset_photos;
create policy asset_photos_member_read on public.asset_photos
for select to authenticated
using (is_site_member(asset_site_id(asset_id)));

drop policy if exists asset_photos_member_insert on public.asset_photos;
create policy asset_photos_member_insert on public.asset_photos
for insert to authenticated
with check (created_by = auth.uid() and is_site_member(asset_site_id(asset_id)));

drop policy if exists asset_photos_member_update on public.asset_photos;
create policy asset_photos_member_update on public.asset_photos
for update to authenticated
using (is_site_member(asset_site_id(asset_id)))
with check (is_site_member(asset_site_id(asset_id)));

drop policy if exists asset_photos_member_delete on public.asset_photos;
create policy asset_photos_member_delete on public.asset_photos
for delete to authenticated
using (is_site_member(asset_site_id(asset_id)));

drop policy if exists assets_member_insert on public.assets;
create policy assets_member_insert on public.assets
for insert to authenticated
with check (
  (production_line_id is null and exists (
    select 1 from public.site_memberships sm
    where sm.user_id=auth.uid()
  ))
  or
  (production_line_id is not null and exists (
    select 1 from public.production_lines pl
    join public.areas a on a.id=pl.area_id
    where pl.id=assets.production_line_id and is_site_member(a.site_id)
  ))
);

drop policy if exists assets_member_update on public.assets;
create policy assets_member_update on public.assets
for update to authenticated
using (is_site_member(asset_site_id(id)))
with check (is_site_member(asset_site_id(id)));

drop policy if exists assets_member_delete on public.assets;
create policy assets_member_delete on public.assets
for delete to authenticated
using (is_site_member(asset_site_id(id)));

insert into storage.buckets (id,name,public)
values ('asset-photos','asset-photos',false)
on conflict (id) do nothing;

drop policy if exists asset_photos_storage_read on storage.objects;
create policy asset_photos_storage_read on storage.objects
for select to authenticated
using (
  bucket_id='asset-photos'
  and is_site_member(asset_site_id((split_part(name,'/',1))::uuid))
);

drop policy if exists asset_photos_storage_insert on storage.objects;
create policy asset_photos_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='asset-photos'
  and is_site_member(asset_site_id((split_part(name,'/',1))::uuid))
);

drop policy if exists asset_photos_storage_update on storage.objects;
create policy asset_photos_storage_update on storage.objects
for update to authenticated
using (
  bucket_id='asset-photos'
  and is_site_member(asset_site_id((split_part(name,'/',1))::uuid))
)
with check (
  bucket_id='asset-photos'
  and is_site_member(asset_site_id((split_part(name,'/',1))::uuid))
);

drop policy if exists asset_photos_storage_delete on storage.objects;
create policy asset_photos_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id='asset-photos'
  and is_site_member(asset_site_id((split_part(name,'/',1))::uuid))
);

grant usage on schema storage to authenticated;

