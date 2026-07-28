-- Run this in your Supabase SQL editor
-- When prompted, choose "Run and enable RLS"

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  matric text unique,
  name text,
  paystack_ref text unique,
  payment_status text not null default 'pending', -- pending | confirmed | failed
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Normalize matric on insert/update (trim + uppercase)
create or replace function normalize_matric()
returns trigger language plpgsql as $$
begin
  if new.matric is not null then
    new.matric := upper(trim(new.matric));
  end if;
  return new;
end;
$$;

create trigger trg_normalize_matric
  before insert or update on users
  for each row execute function normalize_matric();

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table users enable row level security;
-- No policies = zero access for anon/authenticated roles.
-- Service role key on the backend bypasses RLS entirely.

-- ─── Promo codes ────────────────────────────────────────────────────────────
-- One code per user — each row can be redeemed exactly once.
create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  used boolean not null default false,
  used_by_email text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table promo_codes enable row level security;
-- No policies = zero access for anon/authenticated roles.
-- Service role key on the backend bypasses RLS entirely.
