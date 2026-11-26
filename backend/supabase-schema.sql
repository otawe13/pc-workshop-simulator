-- PC WORKSHOP SIMULATOR — ULTIMATE BUSINESS EDITION
-- Supabase PostgreSQL Schema & Row-Level Security (RLS)

create extension if not exists "pgcrypto";

-- 1. Player Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 2 and 24),
  workshop_name text not null check (char_length(workshop_name) between 2 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;

-- 2. Player Workshops (Fair start & financial state snapshot)
create table if not exists public.player_workshops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  workshop_name text not null,
  cash_balance bigint not null check (cash_balance >= 0),
  inventory_value bigint not null default 0 check (inventory_value >= 0),
  equipment_value bigint not null default 2500000 check (equipment_value >= 0),
  upgrades_value bigint not null default 0 check (upgrades_value >= 0),
  wip_value bigint not null default 0 check (wip_value >= 0),
  outstanding_debt bigint not null default 0 check (outstanding_debt >= 0),
  net_worth bigint generated always as (
    cash_balance + inventory_value + equipment_value + upgrades_value + wip_value - outstanding_debt
  ) stored,
  game_day integer not null default 1 check (game_day >= 1),
  updated_at timestamptz not null default now()
);

-- 3. Cloud Save Game Slots (Strictly private per authenticated owner)
create table if not exists public.player_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_id text not null default 'cloud_slot_1',
  workshop_name text not null default 'PC Workshop',
  game_day integer not null default 1 check (game_day >= 1),
  save_payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique(user_id, slot_id)
);

-- 4. Seasons
create table if not exists public.seasons (
  id text primary key, -- 'weekly', 'monthly', 'all_time'
  label text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz
);

insert into public.seasons (id, label) values
  ('weekly', 'Weekly Competition'),
  ('monthly', 'Monthly Championship'),
  ('all_time', 'All-Time Hall of Fame')
on conflict (id) do nothing;

-- 5. Leaderboard Statistics
create table if not exists public.leaderboard_statistics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  workshop_name text not null,
  season text not null references public.seasons(id),
  net_worth bigint not null,
  total_revenue bigint not null default 0,
  net_profit bigint not null default 0,
  completed_orders integer not null default 0,
  avg_satisfaction integer not null default 80 check (avg_satisfaction between 0 and 100),
  reputation integer not null default 20 check (reputation between 0 and 100),
  business_level integer not null default 1 check (business_level between 1 and 5),
  previous_rank integer,
  updated_at timestamptz not null default now(),
  unique(user_id, season)
);

-- 6. Historical Rankings Archive
create table if not exists public.leaderboard_history (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  archived_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  workshop_name text not null,
  final_rank integer not null,
  net_worth bigint not null
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.player_workshops enable row level security;
alter table public.player_saves enable row level security;
alter table public.leaderboard_statistics enable row level security;
alter table public.leaderboard_history enable row level security;
alter table public.seasons enable row level security;

-- Policies: Idempotent drops so re-running this script never fails
drop policy if exists "Public read profiles" on public.profiles;
drop policy if exists "Owner upsert profile" on public.profiles;
drop policy if exists "Owner update profile" on public.profiles;
drop policy if exists "Owner read workshop" on public.player_workshops;
drop policy if exists "Owner read cloud saves" on public.player_saves;
drop policy if exists "Owner write cloud saves" on public.player_saves;
drop policy if exists "Owner update cloud saves" on public.player_saves;
drop policy if exists "Owner delete cloud saves" on public.player_saves;
drop policy if exists "Public read seasons" on public.seasons;
drop policy if exists "Public read leaderboard" on public.leaderboard_statistics;
drop policy if exists "Public read history" on public.leaderboard_history;

-- Profiles: public display fields only, strict owner writes
create policy "Public read profiles" on public.profiles
  for select using (true);
create policy "Owner upsert profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Owner update profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Player Workshops & Cloud Saves: strictly private to authenticated owner
create policy "Owner read workshop" on public.player_workshops
  for select using (auth.uid() = user_id);
create policy "Owner read cloud saves" on public.player_saves
  for select using (auth.uid() = user_id);
create policy "Owner write cloud saves" on public.player_saves
  for insert with check (auth.uid() = user_id);
create policy "Owner update cloud saves" on public.player_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner delete cloud saves" on public.player_saves
  for delete using (auth.uid() = user_id);

-- Seasons & Leaderboards: public read, writes happen strictly via server-validated RPC
create policy "Public read seasons" on public.seasons
  for select using (true);
create policy "Public read leaderboard" on public.leaderboard_statistics
  for select using (true);
create policy "Public read history" on public.leaderboard_history
  for select using (true);

-- Auto-create profile when a new Supabase Auth user signs up (supports email + Google OAuth)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_user text;
  v_workshop text;
  v_avatar text;
begin
  v_raw_user := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'Tech_' || substr(replace(new.id::text, '-', ''), 1, 6)
  );
  v_workshop := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'workshop_name'), ''),
    'PC Workshop'
  );
  v_avatar := nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '');

  insert into public.profiles (id, username, workshop_name, avatar_url)
  values (new.id, left(v_raw_user, 24), left(v_workshop, 40), v_avatar)
  on conflict (id) do nothing;

  return new;
exception
  when unique_violation then
    insert into public.profiles (id, username, workshop_name, avatar_url)
    values (new.id, 'Tech_' || substr(replace(new.id::text, '-', ''), 1, 8), left(v_workshop, 40), v_avatar)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Server-side Validated Snapshot RPC (derives net_worth on server, enforces auth.uid())
create or replace function public.submit_workshop_snapshot(
  p_workshop_name text,
  p_cash_balance bigint,
  p_inventory_value bigint,
  p_equipment_value bigint,
  p_upgrades_value bigint,
  p_wip_value bigint,
  p_debt bigint,
  p_total_revenue bigint,
  p_total_expenses bigint,
  p_completed_orders integer,
  p_avg_satisfaction integer,
  p_reputation integer,
  p_business_level integer,
  p_game_day integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_username text;
  v_computed_net_worth bigint;
  v_net_profit bigint;
  v_season text;
  v_safe_workshop text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_safe_workshop := left(coalesce(nullif(trim(p_workshop_name), ''), 'PC Workshop'), 40);

  select username into v_username from public.profiles where id = v_uid;
  if v_username is null then
    v_username := 'Tech_' || substr(replace(v_uid::text, '-', ''), 1, 6);
    insert into public.profiles (id, username, workshop_name)
    values (v_uid, v_username, v_safe_workshop)
    on conflict (id) do nothing;
  end if;

  v_computed_net_worth :=
    greatest(0, p_cash_balance)
    + greatest(0, p_inventory_value)
    + least(2500000, greatest(0, p_equipment_value))
    + greatest(0, p_upgrades_value)
    + greatest(0, p_wip_value)
    - greatest(0, p_debt);

  v_net_profit := p_total_revenue - p_total_expenses;

  insert into public.player_workshops (
    user_id, workshop_name, cash_balance, inventory_value, equipment_value,
    upgrades_value, wip_value, outstanding_debt, game_day, updated_at
  ) values (
    v_uid, v_safe_workshop, greatest(0, p_cash_balance), greatest(0, p_inventory_value),
    least(2500000, greatest(0, p_equipment_value)), greatest(0, p_upgrades_value),
    greatest(0, p_wip_value), greatest(0, p_debt), greatest(1, p_game_day), now()
  )
  on conflict (user_id) do update set
    workshop_name = excluded.workshop_name,
    cash_balance = excluded.cash_balance,
    inventory_value = excluded.inventory_value,
    upgrades_value = excluded.upgrades_value,
    wip_value = excluded.wip_value,
    outstanding_debt = excluded.outstanding_debt,
    game_day = excluded.game_day,
    updated_at = now();

  foreach v_season in array array['weekly', 'monthly', 'all_time'] loop
    insert into public.leaderboard_statistics (
      user_id, username, workshop_name, season, net_worth, total_revenue,
      net_profit, completed_orders, avg_satisfaction, reputation, business_level, updated_at
    ) values (
      v_uid, v_username, v_safe_workshop, v_season, v_computed_net_worth, p_total_revenue,
      v_net_profit, greatest(0, p_completed_orders),
      least(100, greatest(0, p_avg_satisfaction)),
      least(100, greatest(0, p_reputation)),
      least(5, greatest(1, p_business_level)),
      now()
    )
    on conflict (user_id, season) do update set
      username = excluded.username,
      workshop_name = excluded.workshop_name,
      net_worth = excluded.net_worth,
      total_revenue = excluded.total_revenue,
      net_profit = excluded.net_profit,
      completed_orders = excluded.completed_orders,
      avg_satisfaction = excluded.avg_satisfaction,
      reputation = excluded.reputation,
      business_level = excluded.business_level,
      updated_at = now();
  end loop;
end;
$$;

revoke all on function public.submit_workshop_snapshot(
  text, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, integer, integer, integer, integer
) from public;
grant execute on function public.submit_workshop_snapshot(
  text, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, integer, integer, integer, integer
) to authenticated;
