-- =====================================================================
-- MTOUR PORTUGAL — SCHEMA COMPLETO (v5 consolidado)
-- Cole este ficheiro inteiro no SQL Editor do Supabase e execute.
-- Este ficheiro substitui: supabase-schema.sql + migrações v3, v4 e v5.
-- É idempotente e faz reset dos objetos v1 antigos.
-- =====================================================================

-- ---------- LIMPEZA (idempotente) -----------------------------------
drop schema if exists mtour cascade;
create schema mtour;

-- Dropar TODAS as tabelas do schema public (reset completo idempotente)
do $$ declare r record; begin
  for r in (select tablename from pg_tables where schemaname='public')
  loop execute format('drop table if exists public.%I cascade', r.tablename); end loop;
end $$;

-- Dropar TODAS as sequências do schema public (ex.: seq_lead, seq_oc, etc.)
do $$ declare r record; begin
  for r in (select sequencename from pg_sequences where schemaname='public')
  loop execute format('drop sequence if exists public.%I cascade', r.sequencename); end loop;
end $$;

-- Dropar funções e triggers customizados que possam existir
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin(uuid) cascade;
drop function if exists public.has_role(uuid, public.app_role) cascade;
drop function if exists public.log_audit() cascade;


drop type if exists public.app_role cascade;
drop type if exists public.lead_status cascade;
drop type if exists public.proposal_status cascade;
drop type if exists public.transaction_type cascade;
drop type if exists public.service_status cascade;
drop type if exists public.operation_type cascade;
drop type if exists public.tvde_platform cascade;
drop type if exists public.invoice_kind cascade;
drop type if exists public.invoice_status cascade;
drop type if exists public.doc_type cascade;

-- ---------- ENUMS ---------------------------------------------------
create type public.app_role as enum ('admin','financeiro','comercial','operacional','motorista','administrativo');
create type public.lead_status as enum ('novo','em_negociacao','fechado','perdido');
create type public.proposal_status as enum ('rascunho','enviada','aprovada','rejeitada','convertida');
create type public.service_status as enum (
  'agendado','confirmado','motorista_designado','em_deslocacao',
  'cliente_a_bordo','em_execucao','finalizado','cancelado','nao_realizado'
);
create type public.operation_type as enum ('privado','tvde','interno','outro');
create type public.tvde_platform as enum ('uber','bolt','outra');
create type public.invoice_kind as enum ('entrada','saida');
create type public.invoice_status as enum ('pendente','pago','parcialmente_pago','vencido','cancelado');
create type public.doc_type as enum ('fatura','fatura_recibo','recibo','nota_credito','nota_debito','fatura_simplificada');

-- ---------- UTIL: updated_at ---------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- PROFILES + ROLES ---------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid()=id);
create policy "own profile write" on public.profiles for update to authenticated using (auth.uid()=id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid()=id);
create trigger tg_profiles_upd before update on public.profiles for each row execute function public.tg_set_updated_at();

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_role(_user_id,'admin')
$$;

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id=auth.uid() or public.is_admin(auth.uid()));
create policy "admin manage roles" on public.user_roles for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Auto-criação de profile + promoção do admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
    on conflict (id) do nothing;
  if lower(new.email) = 'sistemamtour@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id,'admin') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- AUDIT LOG ----------------------------------------------
create table public.audit_log (
  id bigserial primary key,
  actor uuid references auth.users(id),
  table_name text not null,
  record_id text,
  action text not null,
  diff jsonb,
  created_at timestamptz default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admin read log" on public.audit_log for select to authenticated using (public.is_admin(auth.uid()));
create policy "system insert log" on public.audit_log for insert to authenticated with check (true);

create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_id text;
begin
  v_id := coalesce((case when tg_op='DELETE' then old.id::text else new.id::text end),'');
  insert into public.audit_log(actor, table_name, record_id, action, diff)
  values (auth.uid(), tg_table_name, v_id, lower(tg_op),
          case when tg_op='DELETE' then to_jsonb(old)
               when tg_op='INSERT' then to_jsonb(new)
               else jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new)) end);
  return coalesce(new, old);
end $$;

-- ---------- SEQUÊNCIAS (numeração automática) ----------------------
create sequence public.seq_lead        start 1;
create sequence public.seq_proposal    start 1;
create sequence public.seq_voucher     start 1;
create sequence public.seq_service     start 1;
create sequence public.seq_oc          start 1;
create sequence public.seq_invoice_in  start 1;
create sequence public.seq_invoice_out start 1;

create or replace function public.next_code(prefix text, seq regclass)
returns text language sql volatile as $$
  select prefix || '-' || to_char(now(),'YYYY') || '-' || lpad(nextval(seq)::text, 5, '0')
$$;

-- ---------- CADASTROS ----------------------------------------------
create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean default true,
  created_at timestamptz default now()
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean default true
);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bank text,
  iban text,
  currency text default 'EUR',
  opening_balance numeric(12,2) default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table public.vat_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rate numeric(5,2) not null,
  is_exempt boolean default false,
  active boolean default true,
  unique(name)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nif text,
  email text,
  phone text,
  address text,
  city text,
  country text default 'Portugal',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger tg_clients_upd before update on public.clients for each row execute function public.tg_set_updated_at();

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  license_number text,
  license_expiry date,
  tvde_card_number text,
  tvde_card_expiry date,
  hire_date date,
  active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger tg_drivers_upd before update on public.drivers for each row execute function public.tg_set_updated_at();

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  brand text,
  model text,
  year int,
  color text,
  seats int,
  fuel_type text,
  operates_tvde boolean default false,
  insurance_expiry date,
  inspection_expiry date,
  iuc_expiry date,
  tvde_license_expiry date,
  active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger tg_vehicles_upd before update on public.vehicles for each row execute function public.tg_set_updated_at();

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  role text,
  email text,
  phone text,
  hire_date date,
  active boolean default true,
  created_at timestamptz default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nif text,
  category text,
  email text,
  phone text,
  address text,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  nif text, email text, phone text,
  commission_pct numeric(5,2),
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text, address text, phone text, email text, contact_person text,
  notes text, active boolean default true,
  created_at timestamptz default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text, address text, phone text, email text, cuisine text,
  notes text, active boolean default true,
  created_at timestamptz default now()
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nif text, contact_person text, email text, phone text,
  commission_pct numeric(5,2),
  notes text, active boolean default true,
  created_at timestamptz default now()
);

create table public.products_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text,
  default_price numeric(12,2),
  default_vat_rate_id uuid references public.vat_rates(id),
  cost_center_id uuid references public.cost_centers(id),
  active boolean default true,
  created_at timestamptz default now()
);

-- Grants + RLS genéricos para cadastros (autenticados)
do $$ declare t text; begin
  foreach t in array array['cost_centers','payment_methods','bank_accounts','vat_rates',
    'clients','drivers','vehicles','employees','suppliers','partners','hotels','restaurants',
    'agencies','products_services']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy "auth read %1$s" on public.%1$s for select to authenticated using (true)$f$, t);
    execute format($f$create policy "auth write %1$s" on public.%1$s for insert to authenticated with check (true)$f$, t);
    execute format($f$create policy "auth upd %1$s" on public.%1$s for update to authenticated using (true)$f$, t);
    execute format($f$create policy "admin del %1$s" on public.%1$s for delete to authenticated using (public.is_admin(auth.uid()))$f$, t);
  end loop;
end $$;

-- ---------- CRM: LEADS + PROPOSTAS ---------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  code text unique default public.next_code('LEAD', 'public.seq_lead'::regclass),
  name text not null,
  email text, phone text,
  origin text,
  status lead_status default 'novo',
  lost_reason text,
  owner_id uuid references auth.users(id),
  client_id uuid references public.clients(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger tg_leads_upd before update on public.leads for each row execute function public.tg_set_updated_at();
grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
create policy "leads read" on public.leads for select to authenticated using (true);
create policy "leads write" on public.leads for insert to authenticated with check (true);
create policy "leads upd" on public.leads for update to authenticated using (true);
create policy "leads del" on public.leads for delete to authenticated using (public.is_admin(auth.uid()));

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  code text unique default public.next_code('PROP','public.seq_proposal'::regclass),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id),
  title text not null,
  description text,
  total_value numeric(12,2) default 0,
  vat_rate_id uuid references public.vat_rates(id),
  status proposal_status default 'rascunho',
  valid_until date,
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger tg_proposals_upd before update on public.proposals for each row execute function public.tg_set_updated_at();
grant select, insert, update, delete on public.proposals to authenticated;
grant all on public.proposals to service_role;
alter table public.proposals enable row level security;
create policy "prop read" on public.proposals for select to authenticated using (true);
create policy "prop write" on public.proposals for insert to authenticated with check (true);
create policy "prop upd" on public.proposals for update to authenticated using (true);
create policy "prop del" on public.proposals for delete to authenticated using (public.is_admin(auth.uid()));

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  product_service_id uuid references public.products_services(id),
  description text,
  quantity numeric(12,2) default 1,
  unit_price numeric(12,2) default 0,
  vat_rate_id uuid references public.vat_rates(id),
  total numeric(12,2) generated always as (quantity * unit_price) stored
);
grant select, insert, update, delete on public.proposal_items to authenticated;
grant all on public.proposal_items to service_role;
alter table public.proposal_items enable row level security;
create policy "propi all" on public.proposal_items for all to authenticated using (true) with check (true);

-- ---------- SERVIÇOS / OC / VOUCHERS -------------------------------
create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  oc_code text unique default public.next_code('OC','public.seq_oc'::regclass),
  voucher_code text unique default public.next_code('VCH','public.seq_voucher'::regclass),
  service_code text unique default public.next_code('SVC','public.seq_service'::regclass),
  proposal_id uuid references public.proposals(id) on delete set null,
  client_id uuid references public.clients(id),
  driver_id uuid references public.drivers(id),
  vehicle_id uuid references public.vehicles(id),
  operation_type public.operation_type default 'privado',
  service_date date not null,
  start_time time,
  origin text,
  destination text,
  itinerary text,
  passengers int,
  sale_value numeric(12,2) default 0,
  payment_method_id uuid references public.payment_methods(id),
  amount_received numeric(12,2) default 0,
  amount_pending numeric(12,2) default 0,
  received_by uuid references auth.users(id),
  status service_status default 'agendado',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on column public.service_orders.operation_type is 'Tipo de serviço: privado, tvde, interno, outro';
create trigger tg_so_upd before update on public.service_orders for each row execute function public.tg_set_updated_at();
create trigger tg_so_audit after insert or update or delete on public.service_orders for each row execute function public.tg_audit();
grant select, insert, update, delete on public.service_orders to authenticated;
grant all on public.service_orders to service_role;
alter table public.service_orders enable row level security;
create policy "so read" on public.service_orders for select to authenticated using (true);
create policy "so write" on public.service_orders for insert to authenticated with check (true);
create policy "so upd" on public.service_orders for update to authenticated using (true);
create policy "so del" on public.service_orders for delete to authenticated using (public.is_admin(auth.uid()));

-- Fechamento do serviço (privado)
create table public.service_closings (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null unique references public.service_orders(id) on delete cascade,
  start_time timestamptz,
  end_time timestamptz,
  km_initial numeric(10,1),
  km_final numeric(10,1),
  km_traveled numeric(10,1) generated always as (coalesce(km_final,0) - coalesce(km_initial,0)) stored,
  sale_value numeric(12,2),
  amount_received numeric(12,2),
  payment_method_id uuid references public.payment_methods(id),
  received_by uuid references auth.users(id),
  balance_pending numeric(12,2),
  incidents text,
  notes text,
  closed_at timestamptz default now(),
  closed_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.service_closings to authenticated;
grant all on public.service_closings to service_role;
alter table public.service_closings enable row level security;
create policy "sc all" on public.service_closings for all to authenticated using (true) with check (true);

-- Despesas do serviço
create table public.service_expenses (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  tvde_shift_id uuid,
  category text not null,
  description text,
  amount numeric(12,2) not null,
  payment_method_id uuid references public.payment_methods(id),
  paid_by uuid references auth.users(id),
  vehicle_id uuid references public.vehicles(id),
  cost_center_id uuid references public.cost_centers(id),
  notes text,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.service_expenses to authenticated;
grant all on public.service_expenses to service_role;
alter table public.service_expenses enable row level security;
create policy "se all" on public.service_expenses for all to authenticated using (true) with check (true);

-- ---------- TVDE ---------------------------------------------------
create table public.tvde_shifts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.drivers(id),
  vehicle_id uuid references public.vehicles(id),
  operation_type operation_type default 'tvde',
  shift_date date not null,
  start_time timestamptz,
  end_time timestamptz,
  km_initial numeric(10,1),
  km_final numeric(10,1),
  notes text,
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.service_expenses
  add constraint service_expenses_tvde_fk foreign key (tvde_shift_id) references public.tvde_shifts(id) on delete cascade;
grant select, insert, update, delete on public.tvde_shifts to authenticated;
grant all on public.tvde_shifts to service_role;
alter table public.tvde_shifts enable row level security;
create policy "shift all" on public.tvde_shifts for all to authenticated using (true) with check (true);

create table public.tvde_earnings (
  id uuid primary key default gen_random_uuid(),
  tvde_shift_id uuid not null references public.tvde_shifts(id) on delete cascade,
  platform tvde_platform not null,
  gross numeric(12,2) default 0,
  tips numeric(12,2) default 0,
  bonus numeric(12,2) default 0,
  commissions numeric(12,2) default 0,
  other_deductions numeric(12,2) default 0,
  net numeric(12,2) generated always as (
    coalesce(gross,0)+coalesce(tips,0)+coalesce(bonus,0)-coalesce(commissions,0)-coalesce(other_deductions,0)
  ) stored,
  notes text
);
grant select, insert, update, delete on public.tvde_earnings to authenticated;
grant all on public.tvde_earnings to service_role;
alter table public.tvde_earnings enable row level security;
create policy "earn all" on public.tvde_earnings for all to authenticated using (true) with check (true);

create table public.tvde_private_jobs (
  id uuid primary key default gen_random_uuid(),
  tvde_shift_id uuid not null references public.tvde_shifts(id) on delete cascade,
  client_name text,
  client_phone text,
  origin text, destination text,
  value numeric(12,2) default 0,
  payment_method_id uuid references public.payment_methods(id),
  payment_status text default 'pendente',
  received_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  oc_code text,
  notes text
);
grant select, insert, update, delete on public.tvde_private_jobs to authenticated;
grant all on public.tvde_private_jobs to service_role;
alter table public.tvde_private_jobs enable row level security;
create policy "tpj all" on public.tvde_private_jobs for all to authenticated using (true) with check (true);

-- ---------- FINANCEIRO / FATURAS -----------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  kind invoice_kind not null,
  code text unique,
  doc_type doc_type default 'fatura',
  invoice_number text,
  series text,
  issue_date date,
  due_date date,
  entity_name text,
  entity_nif text,
  client_id uuid references public.clients(id),
  supplier_id uuid references public.suppliers(id),
  description text,
  value_ex_vat numeric(12,2) default 0,
  vat_rate_id uuid references public.vat_rates(id),
  vat_amount numeric(12,2) default 0,
  vat_deductible numeric(12,2) default 0,
  vat_non_deductible numeric(12,2) default 0,
  deduction_pct numeric(5,2),
  total numeric(12,2) default 0,
  cost_center_id uuid references public.cost_centers(id),
  payment_method_id uuid references public.payment_methods(id),
  bank_account_id uuid references public.bank_accounts(id),
  status invoice_status default 'pendente',
  paid_at date,
  paid_amount numeric(12,2) default 0,
  service_order_id uuid references public.service_orders(id) on delete set null,
  voucher_code text,
  photo_url text,
  observations text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger tg_inv_upd before update on public.invoices for each row execute function public.tg_set_updated_at();
create trigger tg_inv_audit after insert or update or delete on public.invoices for each row execute function public.tg_audit();
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;
create policy "inv read" on public.invoices for select to authenticated using (true);
create policy "inv write" on public.invoices for insert to authenticated with check (true);
create policy "inv upd" on public.invoices for update to authenticated using (true);
create policy "inv del" on public.invoices for delete to authenticated using (public.is_admin(auth.uid()));

create or replace function public.tg_invoice_code()
returns trigger language plpgsql as $$
begin
  if new.code is null then
    new.code := case when new.kind='entrada'
      then public.next_code('FIN','public.seq_invoice_in'::regclass)
      else public.next_code('FOUT','public.seq_invoice_out'::regclass) end;
  end if;
  return new;
end $$;
create trigger tg_invoice_code_bi before insert on public.invoices
  for each row execute function public.tg_invoice_code();

-- Movimento de caixa/conta corrente
create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date date not null default current_date,
  kind invoice_kind not null,
  amount numeric(12,2) not null,
  bank_account_id uuid references public.bank_accounts(id),
  payment_method_id uuid references public.payment_methods(id),
  invoice_id uuid references public.invoices(id) on delete set null,
  service_order_id uuid references public.service_orders(id) on delete set null,
  tvde_shift_id uuid references public.tvde_shifts(id) on delete set null,
  service_expense_id uuid references public.service_expenses(id) on delete set null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.cash_movements to authenticated;
grant all on public.cash_movements to service_role;
alter table public.cash_movements enable row level security;
create policy "cm read" on public.cash_movements for select to authenticated using (true);
create policy "cm write" on public.cash_movements for insert to authenticated with check (true);
create policy "cm upd" on public.cash_movements for update to authenticated using (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'financeiro'));
create policy "cm del" on public.cash_movements for delete to authenticated using (public.is_admin(auth.uid()));

-- ---------- FECHAMENTO MENSAL / IVA / IRC --------------------------
create table public.monthly_closings (
  id uuid primary key default gen_random_uuid(),
  period date not null unique,
  revenue numeric(12,2) default 0,
  expenses numeric(12,2) default 0,
  gross_profit numeric(12,2) default 0,
  operating_profit numeric(12,2) default 0,
  net_profit_est numeric(12,2) default 0,
  vat_charged numeric(12,2) default 0,
  vat_supported numeric(12,2) default 0,
  vat_deductible numeric(12,2) default 0,
  vat_non_deductible numeric(12,2) default 0,
  vat_prev_credit numeric(12,2) default 0,
  vat_to_pay numeric(12,2) default 0,
  vat_credit_carry numeric(12,2) default 0,
  irc_taxable_base_est numeric(12,2) default 0,
  irc_estimate numeric(12,2) default 0,
  irc_payments_on_account numeric(12,2) default 0,
  irc_withholdings numeric(12,2) default 0,
  irc_balance_est numeric(12,2) default 0,
  locked boolean default false,
  locked_at timestamptz,
  locked_by uuid references auth.users(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger tg_mc_upd before update on public.monthly_closings for each row execute function public.tg_set_updated_at();
create trigger tg_mc_audit after insert or update or delete on public.monthly_closings for each row execute function public.tg_audit();
grant select, insert, update, delete on public.monthly_closings to authenticated;
grant all on public.monthly_closings to service_role;
alter table public.monthly_closings enable row level security;
create policy "mc read" on public.monthly_closings for select to authenticated using (true);
create policy "mc write" on public.monthly_closings for insert to authenticated with check (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'financeiro'));
create policy "mc upd"  on public.monthly_closings for update to authenticated using (public.is_admin(auth.uid()));

-- ---------- ALERTAS DE DOCUMENTOS (view derivada de motoristas/veículos) --
create or replace view public.document_alerts as
  select 'driver' as entity, d.id as entity_id, d.full_name as name,
         'Carta de condução' as doc, d.license_expiry as expiry
    from public.drivers d where d.license_expiry is not null
  union all
  select 'driver', d.id, d.full_name, 'Cartão TVDE', d.tvde_card_expiry
    from public.drivers d where d.tvde_card_expiry is not null
  union all
  select 'vehicle', v.id, v.plate, 'Seguro', v.insurance_expiry
    from public.vehicles v where v.insurance_expiry is not null
  union all
  select 'vehicle', v.id, v.plate, 'Inspeção', v.inspection_expiry
    from public.vehicles v where v.inspection_expiry is not null
  union all
  select 'vehicle', v.id, v.plate, 'IUC', v.iuc_expiry
    from public.vehicles v where v.iuc_expiry is not null
  union all
  select 'vehicle', v.id, v.plate, 'Licença TVDE', v.tvde_license_expiry
    from public.vehicles v where v.tvde_license_expiry is not null;
grant select on public.document_alerts to authenticated;

-- ---------- DOCUMENTOS DA EMPRESA (v5) -----------------------------
-- Registo manual de seguros, taxas, licenças, impostos, contratos, etc.
create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'documento',
  -- seguro | licenca | taxa | imposto | alvara | certidao |
  -- contrato | documento | veiculo | outro
  entity text,
  document_number text,
  issuer text,
  amount numeric(12,2),
  currency text default 'EUR',
  issue_date date,
  due_date date not null,
  reminder_days integer not null default 30,
  status text not null default 'ativo', -- ativo | pago | renovado | expirado | cancelado
  responsible text,
  attachment_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null
);
grant select, insert, update, delete on public.company_documents to authenticated;
grant all on public.company_documents to service_role;
alter table public.company_documents enable row level security;
create policy "company_documents read"  on public.company_documents for select to authenticated using (true);
create policy "company_documents write" on public.company_documents for all    to authenticated using (true) with check (true);
create index company_documents_due_date_idx on public.company_documents (due_date);
create index company_documents_status_idx   on public.company_documents (status);
create trigger tg_cdoc_upd before update on public.company_documents for each row execute function public.tg_set_updated_at();

-- ---------- CONFIGURAÇÕES DA EMPRESA (v3) --------------------------
create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mtour Portugal',
  nif text,
  address text,
  postal_code text,
  city text,
  country text default 'Portugal',
  phone text,
  email text,
  website text,
  iban text,
  logo_url text,
  invoice_footer text,
  singleton boolean unique default true,
  updated_at timestamptz default now()
);
grant select on public.company_settings to authenticated;
grant all on public.company_settings to service_role;
alter table public.company_settings enable row level security;
create policy "company read" on public.company_settings for select to authenticated using (true);
create policy "company write admin" on public.company_settings for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
insert into public.company_settings (name, singleton) values ('Mtour Portugal', true)
  on conflict (singleton) do nothing;

-- ---------- RBAC POR MÓDULO (v3) -----------------------------------
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role app_role not null,
  module text not null,
  unique (role, module)
);
grant select on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;
alter table public.role_permissions enable row level security;
create policy "perm read" on public.role_permissions for select to authenticated using (true);
create policy "perm write admin" on public.role_permissions for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create or replace function public.has_module(_user uuid, _module text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = _user and rp.module = _module
  );
$$;

insert into public.role_permissions (role, module) values
  ('admin','dashboard'),('admin','crm'),('admin','propostas'),('admin','oc'),('admin','operacao'),
  ('admin','tvde'),('admin','financeiro'),('admin','conta_corrente'),('admin','fechamento'),
  ('admin','relatorios'),('admin','cadastros'),('admin','pos_venda'),('admin','importar'),
  ('admin','configuracoes'),('admin','agenda'),('admin','alertas'),
  ('comercial','dashboard'),('comercial','crm'),('comercial','propostas'),('comercial','pos_venda'),('comercial','agenda'),
  ('administrativo','dashboard'),('administrativo','financeiro'),('administrativo','conta_corrente'),
  ('administrativo','fechamento'),('administrativo','relatorios'),('administrativo','cadastros'),
  ('administrativo','agenda'),('administrativo','alertas'),
  ('motorista','dashboard'),('motorista','operacao'),('motorista','tvde'),('motorista','agenda')
on conflict (role, module) do nothing;

-- ---------- PÓS-VENDA / PESQUISAS (v3) -----------------------------
create table public.survey_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  questions jsonb not null default '[]'::jsonb,
  active boolean default true,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.survey_templates to authenticated;
grant all on public.survey_templates to service_role;
alter table public.survey_templates enable row level security;
create policy "st read" on public.survey_templates for select to authenticated using (true);
create policy "st write admin" on public.survey_templates for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(16),'hex'),
  template_id uuid references public.survey_templates(id) on delete set null,
  service_order_id uuid references public.service_orders(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_email text,
  client_name text,
  status text default 'pendente',
  sent_at timestamptz,
  answered_at timestamptz,
  nps_score int,
  average_score numeric(4,2),
  answers jsonb default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.surveys to authenticated;
grant select, update on public.surveys to anon;
grant all on public.surveys to service_role;
alter table public.surveys enable row level security;
create policy "srv read auth"  on public.surveys for select to authenticated using (true);
create policy "srv write auth" on public.surveys for all    to authenticated using (true) with check (true);
create policy "srv public read token" on public.surveys for select to anon using (true);
create policy "srv public answer"     on public.surveys for update to anon using (status <> 'respondido') with check (true);

insert into public.survey_templates (name, description, questions) values
  ('Pesquisa Pós-Serviço Padrão','Avaliação geral do serviço prestado.',
   '[
     {"id":"q1","label":"Como avalia o serviço prestado?","type":"rating","required":true},
     {"id":"q2","label":"Como avalia o motorista?","type":"rating","required":true},
     {"id":"q3","label":"Como avalia o veículo?","type":"rating","required":true},
     {"id":"q4","label":"Recomendaria os nossos serviços? (0-10)","type":"nps","required":true},
     {"id":"q5","label":"Comentários adicionais","type":"text","required":false}
   ]'::jsonb)
on conflict do nothing;

-- ---------- STORAGE (faturas) --------------------------------------
insert into storage.buckets (id, name, public) values ('invoices','invoices', true)
  on conflict (id) do nothing;
do $$ begin
  begin
    create policy "invoices read" on storage.objects for select to authenticated using (bucket_id='invoices');
  exception when duplicate_object then null; end;
  begin
    create policy "invoices write" on storage.objects for insert to authenticated with check (bucket_id='invoices');
  exception when duplicate_object then null; end;
  begin
    create policy "invoices upd" on storage.objects for update to authenticated using (bucket_id='invoices');
  exception when duplicate_object then null; end;
end $$;

-- ---------- SEEDS --------------------------------------------------
insert into public.vat_rates (name, rate, is_exempt) values
  ('Normal 23%',23,false),('Intermédia 13%',13,false),('Reduzida 6%',6,false),('Isento',0,true)
  on conflict do nothing;

insert into public.payment_methods (name) values
  ('Dinheiro'),('Multibanco'),('MB WAY'),('Transferência'),('Cartão de Crédito'),('Uber'),('Bolt'),('Outro')
  on conflict do nothing;

insert into public.cost_centers (name, description) values
  ('Combustível','Abastecimento e energia'),
  ('Portagens','Vias com portagem'),
  ('Estacionamento','Parques e vias'),
  ('Manutenção','Oficina e peças'),
  ('Lavagem','Higienização de veículos'),
  ('Administrativo','Despesas gerais'),
  ('Comercial','Marketing e comissões'),
  ('Salários','Pessoal'),
  ('Impostos','Obrigações fiscais')
  on conflict do nothing;

-- Promoção do admin caso já exista
insert into public.user_roles (user_id, role)
  select id, 'admin'::app_role from auth.users where lower(email)='sistemamtour@gmail.com'
  on conflict do nothing;

-- =====================================================================
-- FIM DO SCHEMA CONSOLIDADO (v5)
-- =====================================================================
