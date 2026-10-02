create table public.test_foundation (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now()); alter table public.test_foundation enable row level security;
