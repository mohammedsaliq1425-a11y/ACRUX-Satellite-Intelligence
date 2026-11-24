-- Project Acrux optional storage schema for Supabase (Postgres).
-- Run this once in the Supabase SQL editor (or `supabase db reset` locally).
-- Access model: the backend uses the SERVICE/secret key, which bypasses Row Level Security.
-- RLS is ENABLED with NO policies, so the public anon/publishable key can neither read nor write.
-- Project Acrux has no user accounts; rows belong to the single local operator.

create table if not exists public.saved_locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  notes       text check (notes is null or char_length(notes) <= 500),
  created_at  timestamptz not null default now()
);

create table if not exists public.saved_reports (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(title) between 1 and 120),
  report_type         text not null check (report_type in
                        ('earth_observation','wildfire','weather','telemetry','astronomy','multimodal')),
  payload             jsonb not null,
  contains_simulated  boolean not null default false,
  created_at          timestamptz not null default now()
);

-- Summaries of SIMULATED telemetry runs (config + alerts), never real spacecraft data.
create table if not exists public.simulation_runs (
  id                uuid primary key default gen_random_uuid(),
  seed              integer not null,
  config            jsonb not null,
  alerts            jsonb not null default '[]'::jsonb,
  component_status  jsonb not null default '{}'::jsonb,
  simulated         boolean not null default true check (simulated),
  created_at        timestamptz not null default now()
);

alter table public.saved_locations  enable row level security;
alter table public.saved_reports    enable row level security;
alter table public.simulation_runs  enable row level security;

create index if not exists saved_locations_created_idx on public.saved_locations (created_at desc);
create index if not exists saved_reports_created_idx   on public.saved_reports (created_at desc);
create index if not exists simulation_runs_created_idx on public.simulation_runs (created_at desc);
