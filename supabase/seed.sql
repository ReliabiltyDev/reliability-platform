-- Minimal development-only data for the hierarchy UI.
-- Natural keys keep this safe to re-run and avoid hard-coded generated IDs.

insert into public.sites (code, name, description, timezone)
values ('DEMO-01', 'Demo Reliability Site', 'Local development workspace', 'America/Chicago')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    timezone = excluded.timezone;

insert into public.areas (site_id, code, name, description)
select s.id, 'DEMO-AREA-01', 'Demo Production Area', 'Local development area'
from public.sites s
where s.code = 'DEMO-01'
on conflict (site_id, code) do update
set name = excluded.name,
    description = excluded.description;

insert into public.production_lines (area_id, code, name, description)
select a.id, 'DEMO-LINE-01', 'Demo Production Line', 'Local development line'
from public.areas a
join public.sites s on s.id = a.site_id
where s.code = 'DEMO-01'
  and a.code = 'DEMO-AREA-01'
on conflict (area_id, code) do update
set name = excluded.name,
    description = excluded.description;

insert into public.assets (
  site_id, production_line_id, asset_tag, name, asset_class,
  manufacturer, model, status, criticality, description
)
select s.id, pl.id, 'DEMO-PRESS-001', 'Demo Press', 'Press',
       'Demo Manufacturer', 'DEMO-MODEL-1', 'active', 4,
       'Sample asset for local development.'
from public.sites s
join public.areas a on a.site_id = s.id
join public.production_lines pl on pl.area_id = a.id
where s.code = 'DEMO-01'
  and a.code = 'DEMO-AREA-01'
  and pl.code = 'DEMO-LINE-01'
on conflict (site_id, asset_tag) do update
set production_line_id = excluded.production_line_id,
    name = excluded.name,
    asset_class = excluded.asset_class,
    manufacturer = excluded.manufacturer,
    model = excluded.model,
    status = excluded.status,
    criticality = excluded.criticality,
    description = excluded.description;

