-- Structured, site-scoped maintenance techniques with sourceable measurements and settings.
create table public.maintenance_techniques (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 200),
  category text not null default 'inspection'
    check (category in ('inspection', 'lubrication', 'belt_drive', 'fastening', 'alignment', 'measurement', 'cleaning', 'other')),
  interval text,
  safety_notes text,
  tools text,
  procedure_steps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(procedure_steps) = 'array'),
  measurement_specs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(measurement_specs) = 'array'),
  torque_specs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(torque_specs) = 'array'),
  belt_tension jsonb
    check (belt_tension is null or jsonb_typeof(belt_tension) = 'object'),
  source_document_id uuid references public.documents(id) on delete set null,
  source_reference text,
  source_page text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index maintenance_techniques_site_category_updated_idx
  on public.maintenance_techniques (site_id, category, updated_at desc);
create index maintenance_techniques_asset_idx
  on public.maintenance_techniques (asset_id) where asset_id is not null;

alter table public.maintenance_techniques enable row level security;

grant select, insert, update, delete on public.maintenance_techniques to authenticated;
grant all on public.maintenance_techniques to service_role;

create policy maintenance_techniques_member_read
  on public.maintenance_techniques for select to authenticated
  using (private.is_site_member(site_id));

create policy maintenance_techniques_member_insert
  on public.maintenance_techniques for insert to authenticated
  with check (
    private.is_site_member(site_id)
    and created_by = (select auth.uid())
    and (asset_id is null or private.asset_site_id(asset_id) = site_id)
    and (
      source_document_id is null
      or exists (
        select 1 from public.documents d
        where d.id = source_document_id and d.site_id = site_id
      )
    )
  );

create policy maintenance_techniques_member_update
  on public.maintenance_techniques for update to authenticated
  using (private.is_site_member(site_id))
  with check (
    private.is_site_member(site_id)
    and (asset_id is null or private.asset_site_id(asset_id) = site_id)
    and (
      source_document_id is null
      or exists (
        select 1 from public.documents d
        where d.id = source_document_id and d.site_id = site_id
      )
    )
  );

create policy app_admin_manage_all
  on public.maintenance_techniques for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

comment on table public.maintenance_techniques is
  'Site-scoped maintenance procedures with sourced torque, measurement, and belt tension details.';
comment on column public.maintenance_techniques.belt_tension is
  'Structured belt type, method, target, and units; always retain manufacturer source information.';
comment on column public.maintenance_techniques.measurement_specs is
  'Array of parameter, target/range, units, and method records.';
comment on column public.maintenance_techniques.torque_specs is
  'Array of fastener/location, target value, units, and application notes.';
