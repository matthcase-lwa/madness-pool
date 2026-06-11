-- ============================================================
-- 2027 REFRESH MIGRATION
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Safe to re-run: everything uses IF NOT EXISTS / idempotent guards.
-- ============================================================

-- 1. NCAA team identifier for reliable score syncing.
--    The sync learns these automatically the first time it matches
--    each team, so you don't need to fill them in by hand.
alter table teams add column if not exists ncaa_slug text;

-- 2. Trash Talk chat
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  participant_id uuid references participants(id) on delete set null,
  nickname text not null,
  body text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_year_created
  on chat_messages (year, created_at desc);

-- Row level security: anyone can read, nobody can write with the anon key.
-- All writes go through /api/chat using the service role key after PIN check.
alter table chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chat_messages' and policyname = 'chat_public_read'
  ) then
    create policy chat_public_read on chat_messages
      for select using (true);
  end if;
end $$;

-- 3. Enable realtime broadcasts for the chat table so messages
--    appear instantly without refreshing.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
end $$;

-- Realtime DELETE events need replica identity so moderation removals
-- propagate to connected clients.
alter table chat_messages replica identity full;
