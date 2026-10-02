-- Add site location data and private document-library storage.
alter table public.sites
  add column if not exists state text;

insert into storage.buckets (id, name, public)
values ('reliability-library', 'reliability-library', false)
on conflict (id) do nothing;

grant insert, update on public.documents to authenticated;
grant insert on public.document_versions to authenticated;

create policy reliability_documents_member_insert
on public.documents for insert to authenticated
with check (
  site_id is not null
  and private.is_site_member(site_id)
  and (asset_id is null or private.asset_site_id(asset_id) = site_id)
);

create policy reliability_documents_member_update
on public.documents for update to authenticated
using (site_id is not null and private.is_site_member(site_id))
with check (
  site_id is not null
  and private.is_site_member(site_id)
  and (asset_id is null or private.asset_site_id(asset_id) = site_id)
);

create policy reliability_document_versions_member_insert
on public.document_versions for insert to authenticated
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.site_id is not null
      and private.is_site_member(d.site_id)
  )
);

create policy reliability_library_objects_member_read
on storage.objects for select to authenticated
using (
  bucket_id = 'reliability-library'
  and private.is_site_member((split_part(name, '/', 1))::uuid)
);

create policy reliability_library_objects_member_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'reliability-library'
  and private.is_site_member((split_part(name, '/', 1))::uuid)
);

create policy reliability_library_objects_member_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'reliability-library'
  and private.is_site_member((split_part(name, '/', 1))::uuid)
);
