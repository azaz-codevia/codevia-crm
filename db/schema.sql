-- Codevia CRM schema
-- Safe to run more than once: every statement is idempotent.
-- Run with `npm run db:migrate`, or paste into Supabase → SQL Editor.

create extension if not exists pgcrypto;

-- ── Users ──────────────────────────────────────────────────────────────
create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null,
  password_hash   text not null,
  role            text not null default 'agent' check (role in ('admin', 'manager', 'agent')),
  locale          text not null default 'en' check (locale in ('en', 'ar')),
  calendar_token  text not null default encode(gen_random_bytes(24), 'hex'),
  is_active       boolean not null default true,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists users_email_key on users (lower(email));
create unique index if not exists users_calendar_token_key on users (calendar_token);

-- ── Clients (leads → customers) ────────────────────────────────────────
create table if not exists clients (
  id                  uuid primary key default gen_random_uuid(),
  company_name        text,
  contact_name        text,
  job_title           text,
  email               text,
  phone               text,
  phone_normalized    text,
  city                text,
  industry            text,
  company_size        text,
  website             text,
  services            text[] not null default '{}',
  budget_range        text,
  timeline            text,
  requirements        text,
  status              text not null default 'new'
                      check (status in ('new','contacted','qualified','meeting','proposal','negotiation','won','lost')),
  priority            text not null default 'medium' check (priority in ('low','medium','high')),
  lead_score          integer,
  deal_value          numeric(14,2),
  currency            text not null default 'SAR',
  source              text not null default 'manual',
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  preferred_language  text,
  tags                text[] not null default '{}',
  lost_reason         text,
  discovery           jsonb not null default '{}'::jsonb,
  owner_id            uuid references users(id) on delete set null,
  created_by          uuid references users(id) on delete set null,
  next_follow_up_at   timestamptz,
  last_contacted_at   timestamptz,
  won_at              timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists clients_status_idx     on clients (status);
create index if not exists clients_source_idx     on clients (source);
create index if not exists clients_owner_idx      on clients (owner_id);
create index if not exists clients_created_idx    on clients (created_at desc);
create index if not exists clients_email_idx      on clients (lower(email));
create index if not exists clients_phone_idx      on clients (phone_normalized);
create index if not exists clients_campaign_idx   on clients (utm_campaign);
create index if not exists clients_services_idx   on clients using gin (services);

-- ── Notes ──────────────────────────────────────────────────────────────
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  author_id   uuid references users(id) on delete set null,
  body        text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notes_client_idx on notes (client_id, created_at desc);

-- ── Activity timeline ─────────────────────────────────────────────────
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  type        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activities_client_idx on activities (client_id, created_at desc);
create index if not exists activities_created_idx on activities (created_at desc);

-- ── Meetings ──────────────────────────────────────────────────────────
create table if not exists meetings (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete set null,
  title        text not null,
  description  text,
  location     text,
  meeting_url  text,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  owner_id     uuid references users(id) on delete set null,
  sequence     integer not null default 0,
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists meetings_starts_idx on meetings (starts_at);
create index if not exists meetings_client_idx on meetings (client_id);

-- ── Tasks / follow-ups ────────────────────────────────────────────────
create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete cascade,
  title         text not null,
  due_at        timestamptz,
  priority      text not null default 'medium' check (priority in ('low','medium','high')),
  assignee_id   uuid references users(id) on delete set null,
  completed_at  timestamptz,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists tasks_open_idx on tasks (due_at) where completed_at is null;
create index if not exists tasks_client_idx on tasks (client_id);

-- ── Integrations: API keys + webhook log ──────────────────────────────
create table if not exists api_keys (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  key_prefix    text not null,
  key_hash      text not null unique,
  default_source text not null default 'discovery',
  created_by    uuid references users(id) on delete set null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists webhook_logs (
  id          uuid primary key default gen_random_uuid(),
  api_key_id  uuid references api_keys(id) on delete set null,
  outcome     text not null check (outcome in ('created','updated','rejected','error')),
  client_id   uuid references clients(id) on delete set null,
  payload     jsonb,
  error       text,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists webhook_logs_created_idx on webhook_logs (created_at desc);

-- ── Excel import batches ──────────────────────────────────────────────
create table if not exists import_batches (
  id          uuid primary key default gen_random_uuid(),
  file_name   text,
  total       integer not null default 0,
  created     integer not null default 0,
  updated     integer not null default 0,
  skipped     integer not null default 0,
  failed      integer not null default 0,
  user_id     uuid references users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── updated_at trigger ────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['users','clients','meetings'] loop
    if not exists (
      select 1 from pg_trigger where tgname = t || '_set_updated_at'
    ) then
      execute format(
        'create trigger %I before update on %I for each row execute function set_updated_at()',
        t || '_set_updated_at', t
      );
    end if;
  end loop;
end $$;

-- The app connects with the postgres role from the server only.
-- Lock tables away from Supabase's public REST API (anon/authenticated roles).
alter table users           enable row level security;
alter table clients         enable row level security;
alter table notes           enable row level security;
alter table activities      enable row level security;
alter table meetings        enable row level security;
alter table tasks           enable row level security;
alter table api_keys        enable row level security;
alter table webhook_logs    enable row level security;
alter table import_batches  enable row level security;

-- Safety net for serverless: end sessions left "idle in transaction" (e.g. a frozen function)
-- so they can never hold locks and block every other request.
do $$
begin
  execute format('alter role %I set idle_in_transaction_session_timeout = %L', current_user, '30s');
exception when others then
  raise notice 'Could not set idle_in_transaction_session_timeout: %', sqlerrm;
end $$;
