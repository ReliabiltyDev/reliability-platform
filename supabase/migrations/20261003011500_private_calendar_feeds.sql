create table if not exists public.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  label text not null default 'iPhone Calendar',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists calendar_feed_tokens_active_user_idx
  on public.calendar_feed_tokens (user_id)
  where revoked_at is null;

alter table public.calendar_feed_tokens enable row level security;
grant select, insert, update, delete on public.calendar_feed_tokens to authenticated;

drop policy if exists calendar_feed_tokens_read_own on public.calendar_feed_tokens;
drop policy if exists calendar_feed_tokens_insert_own on public.calendar_feed_tokens;
drop policy if exists calendar_feed_tokens_update_own on public.calendar_feed_tokens;
drop policy if exists calendar_feed_tokens_delete_own on public.calendar_feed_tokens;
create policy calendar_feed_tokens_read_own on public.calendar_feed_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy calendar_feed_tokens_insert_own on public.calendar_feed_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy calendar_feed_tokens_update_own on public.calendar_feed_tokens for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy calendar_feed_tokens_delete_own on public.calendar_feed_tokens for delete to authenticated
  using (user_id = (select auth.uid()));
