-- ToT production schema for Supabase.
-- This project reads and writes messages through Vercel server APIs.
-- The browser must never receive SUPABASE_SERVICE_ROLE_KEY.

create extension if not exists pgcrypto;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  nickname text,
  allow_public boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  reply text,
  reply_updated_at timestamptz,
  likes integer not null default 0,
  receipt_token text,
  reply_supplements jsonb not null default '[]'::jsonb
);

create table if not exists public.reply_supplements (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sticky_notes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  location text,
  location_region text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.messages add column if not exists reply text;
alter table public.messages add column if not exists likes integer not null default 0;
alter table public.messages add column if not exists receipt_token text;
alter table public.messages add column if not exists reply_updated_at timestamptz;
alter table public.messages add column if not exists reply_supplements jsonb not null default '[]'::jsonb;

alter table public.messages enable row level security;
alter table public.reply_supplements enable row level security;
alter table public.sticky_notes enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "anon insert messages" on public.messages;
drop policy if exists "anon read public messages" on public.messages;
drop policy if exists "anon update messages" on public.messages;
drop policy if exists "anon delete messages" on public.messages;
drop policy if exists "authenticated read messages" on public.messages;
drop policy if exists "authenticated update messages" on public.messages;
drop policy if exists "authenticated delete messages" on public.messages;
drop policy if exists "no anonymous direct read" on public.messages;
drop policy if exists "no anonymous direct insert" on public.messages;
drop policy if exists "no anonymous direct update" on public.messages;
drop policy if exists "no anonymous direct delete" on public.messages;

revoke all on table public.messages from anon;
revoke all on table public.messages from authenticated;
revoke all on table public.reply_supplements from anon;
revoke all on table public.reply_supplements from authenticated;
revoke all on table public.sticky_notes from anon;
revoke all on table public.sticky_notes from authenticated;
revoke all on table public.site_settings from anon;
revoke all on table public.site_settings from authenticated;

-- No anon/authenticated policies are created here on purpose.
-- Visitor submission, public reading, likes, admin review, publish, delete,
-- and replies are all mediated by Next.js Route Handlers using service_role.
-- Supabase service_role bypasses RLS, so keep it server-only in Vercel.
