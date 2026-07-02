-- =====================================================================
-- MTOUR PORTUGAL — Schema completo (execute no SQL Editor do Supabase)
-- Projeto: https://owbrfxntriauzkhoesap.supabase.co
-- =====================================================================

-- Extensões
create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
do $$ begin
  create type app_role as enum ('admin', 'comercial', 'motorista', 'pos_venda');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('novo', 'qualificado', 'proposta', 'fechado', 'perdido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type proposal_status as enum ('rascunho', 'enviada', 'aceita', 'recusada', 'concluida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type as enum ('entrada', 'saida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_cost_type as enum ('fixo', 'variavel');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "profiles: self read" on public.profiles;
create policy "profiles: self read" on public.profiles for select
  to authenticated using (auth.uid() = id);

drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update" on public.profiles for update
  to authenticated using (auth.uid() = id);

drop policy if exists "profiles: self insert" on public.profiles;
create policy "profiles: self insert" on public.profiles for insert
  to authenticated with check (auth.uid() = id);

-- ---------- USER ROLES (nunca no profiles) ----------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

drop policy if exists "roles: self read" on public.user_roles;
create policy "roles: self read" on public.user_roles for select
  to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Auto-cria profile + role padrão 'comercial' ao registar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'comercial')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- LEADS ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  origin text,
  indication_name text,
  partner text,
  user_id uuid references auth.users(id) on delete set null,
  status lead_status not null default 'novo',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
drop policy if exists "leads: auth all" on public.leads;
create policy "leads: auth all" on public.leads for all
  to authenticated using (true) with check (true);

-- ---------- CLIENT QUALIFICATIONS ----------
create table if not exists public.client_qualifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  passenger_count int,
  profile text,
  language text,
  special_needs text,
  accommodation text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.client_qualifications to authenticated;
grant all on public.client_qualifications to service_role;
alter table public.client_qualifications enable row level security;
drop policy if exists "qual: auth all" on public.client_qualifications;
create policy "qual: auth all" on public.client_qualifications for all
  to authenticated using (true) with check (true);

-- ---------- TRAVELS ----------
create table if not exists public.travels (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  arrival_datetime timestamptz,
  arrival_flight text,
  departure_datetime timestamptz,
  departure_flight text,
  objective text,
  interests jsonb default '[]'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.travels to authenticated;
grant all on public.travels to service_role;
alter table public.travels enable row level security;
drop policy if exists "travels: auth all" on public.travels;
create policy "travels: auth all" on public.travels for all
  to authenticated using (true) with check (true);

-- ---------- PROPOSALS ----------
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  service_number text unique,
  proposal_date date default current_date,
  service_type text,
  total_value numeric(12,2) default 0,
  user_id uuid references auth.users(id) on delete set null,
  status proposal_status not null default 'rascunho',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.proposals to authenticated;
grant all on public.proposals to service_role;
alter table public.proposals enable row level security;
drop policy if exists "proposals: auth all" on public.proposals;
create policy "proposals: auth all" on public.proposals for all
  to authenticated using (true) with check (true);

-- ---------- PROPOSAL DAYS ----------
create table if not exists public.proposal_days (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  day_number int not null,
  description text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.proposal_days to authenticated;
grant all on public.proposal_days to service_role;
alter table public.proposal_days enable row level security;
drop policy if exists "pdays: auth all" on public.proposal_days;
create policy "pdays: auth all" on public.proposal_days for all
  to authenticated using (true) with check (true);

-- ---------- PAYMENTS ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  payment_method text,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
drop policy if exists "payments: auth all" on public.payments;
create policy "payments: auth all" on public.payments for all
  to authenticated using (true) with check (true);

-- ---------- VEHICLES ----------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text unique not null,
  brand text,
  model text,
  year int,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
drop policy if exists "vehicles: auth all" on public.vehicles;
create policy "vehicles: auth all" on public.vehicles for all
  to authenticated using (true) with check (true);

-- ---------- VEHICLE COSTS ----------
create table if not exists public.vehicle_costs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  type vehicle_cost_type not null,
  name text not null,
  amount numeric(12,2) not null,
  date date not null default current_date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.vehicle_costs to authenticated;
grant all on public.vehicle_costs to service_role;
alter table public.vehicle_costs enable row level security;
drop policy if exists "vcosts: auth all" on public.vehicle_costs;
create policy "vcosts: auth all" on public.vehicle_costs for all
  to authenticated using (true) with check (true);

-- ---------- DRIVER DAYS ----------
create table if not exists public.driver_days (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references auth.users(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  date date not null default current_date,
  start_time timestamptz,
  end_time timestamptz,
  km_initial numeric(10,1),
  km_final numeric(10,1),
  fuel_initial numeric(5,2),
  fuel_final numeric(5,2),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.driver_days to authenticated;
grant all on public.driver_days to service_role;
alter table public.driver_days enable row level security;
drop policy if exists "ddays: auth all" on public.driver_days;
create policy "ddays: auth all" on public.driver_days for all
  to authenticated using (true) with check (true);

-- ---------- CHECKLIST ----------
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);
grant select, insert, update, delete on public.checklist_items to authenticated;
grant all on public.checklist_items to service_role;
alter table public.checklist_items enable row level security;
drop policy if exists "citems: auth all" on public.checklist_items;
create policy "citems: auth all" on public.checklist_items for all
  to authenticated using (true) with check (true);

create table if not exists public.driver_day_checklist (
  id uuid primary key default gen_random_uuid(),
  driver_day_id uuid not null references public.driver_days(id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  checked boolean not null default false
);
grant select, insert, update, delete on public.driver_day_checklist to authenticated;
grant all on public.driver_day_checklist to service_role;
alter table public.driver_day_checklist enable row level security;
drop policy if exists "ddc: auth all" on public.driver_day_checklist;
create policy "ddc: auth all" on public.driver_day_checklist for all
  to authenticated using (true) with check (true);

-- ---------- DRIVER SERVICES ----------
create table if not exists public.driver_services (
  id uuid primary key default gen_random_uuid(),
  driver_day_id uuid not null references public.driver_days(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.driver_services to authenticated;
grant all on public.driver_services to service_role;
alter table public.driver_services enable row level security;
drop policy if exists "dservices: auth all" on public.driver_services;
create policy "dservices: auth all" on public.driver_services for all
  to authenticated using (true) with check (true);

-- ---------- TRANSACTIONS ----------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  driver_day_id uuid references public.driver_days(id) on delete set null,
  type transaction_type not null,
  establishment text,
  invoice_number text,
  amount numeric(12,2) not null,
  photo_url text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
drop policy if exists "tx: auth all" on public.transactions;
create policy "tx: auth all" on public.transactions for all
  to authenticated using (true) with check (true);

-- ---------- MAINTENANCE ----------
create table if not exists public.maintenances (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  type text,
  km numeric(10,1),
  date date not null default current_date,
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.maintenances to authenticated;
grant all on public.maintenances to service_role;
alter table public.maintenances enable row level security;
drop policy if exists "mt: auth all" on public.maintenances;
create policy "mt: auth all" on public.maintenances for all
  to authenticated using (true) with check (true);

create table if not exists public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  name text not null
);
grant select, insert, update, delete on public.maintenance_items to authenticated;
grant all on public.maintenance_items to service_role;
alter table public.maintenance_items enable row level security;
drop policy if exists "mti: auth all" on public.maintenance_items;
create policy "mti: auth all" on public.maintenance_items for all
  to authenticated using (true) with check (true);

create table if not exists public.maintenance_item_checks (
  id uuid primary key default gen_random_uuid(),
  maintenance_id uuid not null references public.maintenances(id) on delete cascade,
  maintenance_item_id uuid not null references public.maintenance_items(id) on delete cascade,
  checked boolean not null default false
);
grant select, insert, update, delete on public.maintenance_item_checks to authenticated;
grant all on public.maintenance_item_checks to service_role;
alter table public.maintenance_item_checks enable row level security;
drop policy if exists "mtic: auth all" on public.maintenance_item_checks;
create policy "mtic: auth all" on public.maintenance_item_checks for all
  to authenticated using (true) with check (true);

-- ---------- EVALUATIONS ----------
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comments text,
  image_authorization boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.evaluations to authenticated;
grant all on public.evaluations to service_role;
alter table public.evaluations enable row level security;
drop policy if exists "eval: auth all" on public.evaluations;
create policy "eval: auth all" on public.evaluations for all
  to authenticated using (true) with check (true);

-- ---------- REFERRALS ----------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  lead_id_original uuid references public.leads(id) on delete set null,
  referred_name text not null,
  referred_phone text,
  referred_email text,
  new_lead_id uuid references public.leads(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.referrals to authenticated;
grant all on public.referrals to service_role;
alter table public.referrals enable row level security;
drop policy if exists "ref: auth all" on public.referrals;
create policy "ref: auth all" on public.referrals for all
  to authenticated using (true) with check (true);

-- ---------- STORAGE (faturas) ----------
insert into storage.buckets (id, name, public) values ('invoices','invoices', true)
on conflict (id) do nothing;

drop policy if exists "invoices: auth upload" on storage.objects;
create policy "invoices: auth upload" on storage.objects for insert
  to authenticated with check (bucket_id = 'invoices');

drop policy if exists "invoices: public read" on storage.objects;
create policy "invoices: public read" on storage.objects for select
  using (bucket_id = 'invoices');

-- ---------- SEEDS ----------
insert into public.checklist_items (name) values
  ('Pneus'), ('Óleo'), ('Luzes'), ('Freios'), ('Documentação'), ('Limpeza')
on conflict do nothing;

insert into public.maintenance_items (name) values
  ('Troca de óleo'), ('Filtros'), ('Pastilhas de freio'), ('Alinhamento'), ('Correia dentada')
on conflict do nothing;

-- ---------- ADMIN BOOTSTRAP ----------
create or replace function public.promote_mtour_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'sistemamtour@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin
  after insert on auth.users
  for each row execute function public.promote_mtour_admin();

insert into public.user_roles (user_id, role)
select id, 'admin'::app_role from auth.users where lower(email) = 'sistemamtour@gmail.com'
on conflict do nothing;

-- =====================================================================
-- FIM.
-- 1) Executa este SQL no SQL Editor do Supabase.
-- 2) Authentication → Providers → ativa Email (e Google se quiseres).
-- 3) Authentication → Users → Add user:
--      email: sistemamtour@gmail.com
--      password: Admin123!
--      marca "Auto Confirm User"
--    O trigger acima promove automaticamente a admin.
-- =====================================================================
