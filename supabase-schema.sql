-- =====================================================================
-- MTOUR PORTUGAL — SCHEMA COMPLETO (v22 consolidado)
-- Cole este ficheiro inteiro no SQL Editor do Supabase e execute.
-- Este ficheiro substitui todas as migrações (v3 a v22).
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
-- BLOCO V6 (supabase-migration-v6.sql)
-- =====================================================================

-- V6: Roteiros (tour routes) + proposal type/roteiro linkage
-- Idempotente. Cole no SQL Editor do Supabase.

create table if not exists public.tour_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,          -- Lisboa, Porto, etc.
  description text,
  default_price numeric(12,2),
  duration_hours numeric(6,2),
  active boolean default true,
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.tour_routes to authenticated;
grant all on public.tour_routes to service_role;
alter table public.tour_routes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='tour_routes' and policyname='tr read') then
    create policy "tr read" on public.tour_routes for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tour_routes' and policyname='tr write') then
    create policy "tr write" on public.tour_routes for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tour_routes' and policyname='tr upd') then
    create policy "tr upd" on public.tour_routes for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tour_routes' and policyname='tr del') then
    create policy "tr del" on public.tour_routes for delete to authenticated using (public.is_admin(auth.uid()));
  end if;
end $$;

-- Ligar propostas a roteiros
alter table public.proposals
  add column if not exists proposal_type text default 'servico',   -- 'servico' | 'roteiro' | 'transfer' | 'outro'
  add column if not exists tour_route_id uuid references public.tour_routes(id),
  add column if not exists tour_route_custom text;

-- Seeds (não duplica pelo nome)
insert into public.tour_routes (name, region) values
  ('City Tour por Lisboa', 'Lisboa'),
  ('Bate-Volta a partir de Lisboa: Sintra, Azenhas do Mar, Cabo da Roca e Cascais', 'Lisboa'),
  ('Bate-Volta a partir de Lisboa: Fátima, Nazaré e Óbidos', 'Lisboa'),
  ('Bate-Volta a partir de Lisboa: Évora + Vinícola + Freeport', 'Lisboa'),
  ('Roteiros Personalizados em Lisboa', 'Lisboa'),
  ('Bate-Volta a partir do Porto: Braga e Guimarães', 'Porto'),
  ('Bate-Volta a partir do Porto: Região do Douro', 'Porto'),
  ('Bate-Volta a partir do Porto: Coimbra e Aveiro', 'Porto'),
  ('Bate-Volta a partir do Porto: Santiago de Compostela e a Catedral (Espanha)', 'Porto')
on conflict do nothing;


-- =====================================================================
-- BLOCO V7 (supabase-migration-v7.sql)
-- =====================================================================

-- v7: Arquivar leads (retirar do pipeline mantendo na lista)
alter table public.leads
  add column if not exists archived boolean not null default false;

create index if not exists idx_leads_archived on public.leads(archived);


-- =====================================================================
-- BLOCO V8 (supabase-migration-v8.sql)
-- =====================================================================

-- V8: Status configuráveis + Split operacional/financeiro nas OCs
-- Idempotente. Cole no SQL Editor do Supabase.

-- 1) Separar estado operacional e financeiro nas OCs
alter table public.service_orders
  add column if not exists financial_status text default 'nao_faturado';

-- Backfill: mover estados financeiros antigos
update public.service_orders
  set financial_status = status
  where status in ('faturado','pago')
    and (financial_status is null or financial_status = 'nao_faturado');

update public.service_orders
  set status = 'finalizado'
  where status in ('faturado','pago');

-- 2) Tabela de estados configuráveis pelo Admin
create table if not exists public.status_options (
  id uuid primary key default gen_random_uuid(),
  domain text not null,     -- 'proposal_status' | 'oc_operational_status' | 'oc_financial_status'
  code text not null,
  label text not null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (domain, code)
);

grant select on public.status_options to anon;
grant select, insert, update, delete on public.status_options to authenticated;
grant all on public.status_options to service_role;

alter table public.status_options enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='status_options' and policyname='status read') then
    create policy "status read" on public.status_options for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='status_options' and policyname='status ins') then
    create policy "status ins" on public.status_options for insert to authenticated with check (public.is_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='status_options' and policyname='status upd') then
    create policy "status upd" on public.status_options for update to authenticated using (public.is_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='status_options' and policyname='status del') then
    create policy "status del" on public.status_options for delete to authenticated using (public.is_admin(auth.uid()));
  end if;
end $$;

-- Seeds
insert into public.status_options (domain, code, label, sort) values
  ('proposal_status','rascunho','Rascunho',10),
  ('proposal_status','enviada','Enviada',20),
  ('proposal_status','aprovada','Aprovada',30),
  ('proposal_status','convertida','Convertida',40),
  ('proposal_status','rejeitada','Rejeitada',50),
  ('oc_operational_status','agendado','Agendado',10),
  ('oc_operational_status','em_execucao','Em execução',20),
  ('oc_operational_status','finalizado','Finalizado',30),
  ('oc_operational_status','no_show','No-show',40),
  ('oc_operational_status','cancelado','Cancelado',50),
  ('oc_operational_status','reagendado','Reagendado',60),
  ('oc_financial_status','nao_faturado','Não faturado',10),
  ('oc_financial_status','faturado','Faturado',20),
  ('oc_financial_status','pago','Pago',30)
on conflict (domain, code) do nothing;


-- =====================================================================
-- BLOCO V9 (supabase-migration-v9.sql)
-- =====================================================================

-- V9: Tipo de proposta/operação gerido em Configurações (Admin)
-- Idempotente. Cole no SQL Editor do Supabase.

insert into public.status_options (domain, code, label, sort) values
  ('operation_type','privado','Privado',10),
  ('operation_type','tvde','TVDE',20),
  ('operation_type','interno','Interno',30),
  ('operation_type','servico','Serviço',40),
  ('operation_type','roteiro','Roteiro',50),
  ('operation_type','transfer','Transfer',60),
  ('operation_type','outro','Outro',99)
on conflict (domain, code) do nothing;


-- =====================================================================
-- BLOCO V10 (supabase-migration-v10-sync-financeiro.sql)
-- =====================================================================

-- ============================================================
-- Mtour v10 — Sincronização automática do Financeiro
-- Cole no SQL Editor do Supabase e execute uma vez.
-- Objetivo: lançar em cash_movements todos os valores já
-- registados no sistema (OCs finalizadas, despesas de serviço,
-- turnos TVDE fechados) que ainda não têm o movimento espelho.
-- Também instala triggers para manter a sincronia automática.
-- Idempotente: pode ser executado várias vezes.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) BACKFILL: Recebimentos de Ordens de Serviço finalizadas
-- ------------------------------------------------------------
INSERT INTO public.cash_movements (kind, amount, service_order_id, description, movement_date, created_at)
SELECT 'entrada',
       COALESCE(sc.amount_received, so.amount_received, so.sale_value, 0),
       so.id,
       'Recebimento OC ' || COALESCE(so.oc_code, ''),
       COALESCE(sc.closed_at::date, so.service_date, CURRENT_DATE),
       now()
FROM public.service_orders so
LEFT JOIN public.service_closings sc ON sc.service_order_id = so.id
WHERE so.status = 'finalizado'
  AND COALESCE(sc.amount_received, so.amount_received, so.sale_value, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_movements cm
     WHERE cm.service_order_id = so.id
       AND cm.kind = 'entrada'
       AND cm.service_expense_id IS NULL
  );

-- ------------------------------------------------------------
-- 2) BACKFILL: Despesas de serviço já registadas
-- ------------------------------------------------------------
INSERT INTO public.cash_movements (kind, amount, service_order_id, tvde_shift_id, service_expense_id,
                                   payment_method_id, description, movement_date, created_at)
SELECT 'saida',
       se.amount,
       se.service_order_id,
       se.tvde_shift_id,
       se.id,
       se.payment_method_id,
       'Despesa (' || se.category || ')' ||
         COALESCE(' · ' || NULLIF(se.description, ''), '') ||
         COALESCE(' · OC ' || so.oc_code, ''),
       COALESCE(se.created_at::date, CURRENT_DATE),
       now()
FROM public.service_expenses se
LEFT JOIN public.service_orders so ON so.id = se.service_order_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.cash_movements cm WHERE cm.service_expense_id = se.id
);

-- ------------------------------------------------------------
-- 3) BACKFILL: Turnos TVDE fechados
--    Entrada = líquido plataformas (bruto+gorj+bónus - comissões - retenções)
--    Saída  = comissão devida ao motorista (% extraída das notas)
-- ------------------------------------------------------------
WITH tvde_agg AS (
  SELECT ts.id AS shift_id,
         ts.shift_date,
         ts.notes,
         COALESCE(SUM(te.gross + COALESCE(te.tips,0) + COALESCE(te.bonus,0)
                    - COALESCE(te.commissions,0) - COALESCE(te.other_deductions,0)), 0) AS net_plat,
         (regexp_match(COALESCE(ts.notes,''), 'Motorista %:\s*([0-9]+(?:\.[0-9]+)?)'))[1] AS pct_txt
    FROM public.tvde_shifts ts
    LEFT JOIN public.tvde_earnings te ON te.tvde_shift_id = ts.id
   WHERE ts.closed_at IS NOT NULL
     AND ts.operation_type = 'tvde'
   GROUP BY ts.id
)
INSERT INTO public.cash_movements (kind, amount, tvde_shift_id, description, movement_date, created_at)
SELECT 'entrada', ROUND(net_plat::numeric, 2), shift_id,
       'TVDE · líquido plataformas (' || shift_date || ')',
       shift_date, now()
  FROM tvde_agg
 WHERE net_plat > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.cash_movements cm
      WHERE cm.tvde_shift_id = tvde_agg.shift_id
        AND cm.kind = 'entrada'
        AND cm.service_expense_id IS NULL
   );

WITH tvde_agg AS (
  SELECT ts.id AS shift_id,
         ts.shift_date,
         ts.notes,
         COALESCE(SUM(te.gross + COALESCE(te.tips,0) + COALESCE(te.bonus,0)
                    - COALESCE(te.commissions,0) - COALESCE(te.other_deductions,0)), 0) AS net_plat,
         COALESCE(((regexp_match(COALESCE(ts.notes,''), 'Motorista %:\s*([0-9]+(?:\.[0-9]+)?)'))[1])::numeric, 0) AS pct
    FROM public.tvde_shifts ts
    LEFT JOIN public.tvde_earnings te ON te.tvde_shift_id = ts.id
   WHERE ts.closed_at IS NOT NULL
     AND ts.operation_type = 'tvde'
   GROUP BY ts.id
)
INSERT INTO public.cash_movements (kind, amount, tvde_shift_id, description, movement_date, created_at)
SELECT 'saida',
       ROUND(((net_plat * pct) / 100)::numeric, 2),
       shift_id,
       'TVDE · comissão motorista ' || pct || '% (' || shift_date || ')',
       shift_date, now()
  FROM tvde_agg
 WHERE pct > 0 AND net_plat > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.cash_movements cm
      WHERE cm.tvde_shift_id = tvde_agg.shift_id
        AND cm.kind = 'saida'
        AND cm.service_expense_id IS NULL
        AND cm.description LIKE 'TVDE · comissão motorista%'
   );

-- ------------------------------------------------------------
-- 4) TRIGGER: manter service_expenses ↔ cash_movements sincronizado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_expense_to_cash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.cash_movements WHERE service_expense_id = NEW.id) THEN
      INSERT INTO public.cash_movements (kind, amount, service_order_id, tvde_shift_id,
                                         service_expense_id, payment_method_id, description,
                                         movement_date, created_by)
      VALUES ('saida', NEW.amount, NEW.service_order_id, NEW.tvde_shift_id,
              NEW.id, NEW.payment_method_id,
              'Despesa (' || NEW.category || ')' || COALESCE(' · ' || NULLIF(NEW.description,''), ''),
              COALESCE(NEW.created_at::date, CURRENT_DATE), NEW.paid_by);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_movements
       SET amount = NEW.amount,
           payment_method_id = NEW.payment_method_id,
           description = 'Despesa (' || NEW.category || ')' || COALESCE(' · ' || NULLIF(NEW.description,''), '')
     WHERE service_expense_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.cash_movements WHERE service_expense_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_expense_to_cash ON public.service_expenses;
CREATE TRIGGER trg_sync_expense_to_cash
  AFTER INSERT OR UPDATE OR DELETE ON public.service_expenses
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_expense_to_cash();

-- ------------------------------------------------------------
-- 5) TRIGGER: quando service_closings recebe amount_received,
--    garante entrada em cash_movements.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_closing_to_cash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oc_txt text;
BEGIN
  IF COALESCE(NEW.amount_received, 0) <= 0 THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.cash_movements
     WHERE service_order_id = NEW.service_order_id
       AND kind = 'entrada'
       AND service_expense_id IS NULL
  ) THEN RETURN NEW; END IF;
  SELECT oc_code INTO oc_txt FROM public.service_orders WHERE id = NEW.service_order_id;
  INSERT INTO public.cash_movements (kind, amount, service_order_id, payment_method_id, description,
                                     movement_date, created_by)
  VALUES ('entrada', NEW.amount_received, NEW.service_order_id, NEW.payment_method_id,
          'Recebimento OC ' || COALESCE(oc_txt, ''),
          COALESCE(NEW.closed_at::date, CURRENT_DATE), NEW.closed_by);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_closing_to_cash ON public.service_closings;
CREATE TRIGGER trg_sync_closing_to_cash
  AFTER INSERT OR UPDATE ON public.service_closings
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_closing_to_cash();

COMMIT;

-- Verificação rápida:
-- SELECT kind, COUNT(*), SUM(amount) FROM public.cash_movements GROUP BY kind;


-- =====================================================================
-- BLOCO V11 (supabase-migration-v11-leads.sql)
-- =====================================================================

-- ============================================================
-- Mtour v11 — Leads: temperatura, dados do cliente e viagem
-- Idempotente. Cole no SQL Editor do Supabase e execute.
-- ============================================================

create sequence if not exists public.seq_lead_client start 1;

alter table public.leads
  add column if not exists temperature text default 'frio',
  add column if not exists client_number text unique
    default public.next_code('CLI', 'public.seq_lead_client'::regclass),
  add column if not exists nif text,
  add column if not exists birth_date date,
  add column if not exists phone_country text default '+351',
  add column if not exists emergency_contact text,
  add column if not exists arrival_date date,
  add column if not exists arrival_time time,
  add column if not exists arrival_place text,
  add column if not exists departure_date date,
  add column if not exists departure_time time,
  add column if not exists departure_place text,
  add column if not exists passengers integer;

-- Preenche número de cliente para leads antigos
update public.leads
   set client_number = public.next_code('CLI', 'public.seq_lead_client'::regclass)
 where client_number is null;

create index if not exists idx_leads_temperature on public.leads(temperature);
create index if not exists idx_leads_origin on public.leads(origin);


-- =====================================================================
-- BLOCO V12 (supabase-migration-v12-clientes.sql)
-- =====================================================================

-- ============================================================
-- Mtour v12 — Clientes: paridade com Leads, número de cliente fixo
-- e códigos de serviço prefixados pelo número do cliente.
-- Idempotente. Cole no SQL Editor do Supabase e execute.
-- ============================================================

-- 1) Sequência e número de cliente (imutável) -----------------
create sequence if not exists public.seq_client start 1;

create or replace function public.next_client_number()
returns text language sql volatile as $$
  select 'C' || lpad(nextval('public.seq_client')::text, 5, '0')
$$;

alter table public.clients
  add column if not exists client_number text unique default public.next_client_number(),
  add column if not exists origin text,
  add column if not exists birth_date date,
  add column if not exists phone_country text default '+351',
  add column if not exists emergency_contact text,
  add column if not exists arrival_date date,
  add column if not exists arrival_time time,
  add column if not exists arrival_place text,
  add column if not exists departure_date date,
  add column if not exists departure_time time,
  add column if not exists departure_place text,
  add column if not exists passengers integer,
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

-- Preenche clientes antigos
update public.clients
   set client_number = public.next_client_number()
 where client_number is null;

-- 2) Número de cliente nunca muda -----------------------------
create or replace function public.tg_lock_client_number()
returns trigger language plpgsql as $$
begin
  if new.client_number is distinct from old.client_number then
    new.client_number := old.client_number;
  end if;
  return new;
end $$;

drop trigger if exists tg_clients_lock_number on public.clients;
create trigger tg_clients_lock_number
  before update on public.clients
  for each row execute function public.tg_lock_client_number();

-- 3) Códigos de serviço iniciam pelo número do cliente --------
create or replace function public.tg_service_codes_client_prefix()
returns trigger language plpgsql as $$
declare
  cn text;
begin
  if new.client_id is null then
    return new;
  end if;

  select client_number into cn from public.clients where id = new.client_id;
  if cn is null then
    return new;
  end if;

  if new.oc_code is null or left(new.oc_code, length(cn) + 1) <> cn || '-' then
    new.oc_code := cn || '-' || coalesce(nullif(new.oc_code, ''),
                     public.next_code('OC', 'public.seq_oc'::regclass));
  end if;

  if new.voucher_code is null or left(new.voucher_code, length(cn) + 1) <> cn || '-' then
    new.voucher_code := cn || '-' || coalesce(nullif(new.voucher_code, ''),
                          public.next_code('VCH', 'public.seq_voucher'::regclass));
  end if;

  if new.service_code is null or left(new.service_code, length(cn) + 1) <> cn || '-' then
    new.service_code := cn || '-' || coalesce(nullif(new.service_code, ''),
                          public.next_code('SVC', 'public.seq_service'::regclass));
  end if;

  return new;
end $$;

drop trigger if exists tg_service_orders_client_prefix on public.service_orders;
create trigger tg_service_orders_client_prefix
  before insert on public.service_orders
  for each row execute function public.tg_service_codes_client_prefix();

-- 4) Índices --------------------------------------------------
create index if not exists idx_clients_client_number on public.clients(client_number);
create index if not exists idx_clients_origin on public.clients(origin);
create index if not exists idx_clients_lead_id on public.clients(lead_id);

-- 5) Grants (garantia) ---------------------------------------
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;


-- =====================================================================
-- BLOCO V13 (supabase-migration-v13-propostas.sql)
-- =====================================================================

-- ============================================================
-- Mtour v13 — Proposta/Roteiro Personalizado, Orçamento e Voucher
-- Idempotente. Cole no SQL Editor do Supabase e execute.
-- ============================================================

-- 1) Novos campos na proposta ---------------------------------
alter table public.proposals
  add column if not exists proposal_kind text default 'roteiro_personalizado', -- roteiro_personalizado | servico_privado
  add column if not exists responsible text,
  add column if not exists passengers integer,
  add column if not exists arrival_date date,
  add column if not exists arrival_time time,
  add column if not exists arrival_place text,
  add column if not exists departure_date date,
  add column if not exists departure_time time,
  add column if not exists departure_place text,
  add column if not exists itinerary_start date,
  add column if not exists itinerary_end date,
  add column if not exists days_count integer,
  add column if not exists itinerary jsonb default '[]'::jsonb,
  add column if not exists payment_terms text,
  add column if not exists descriptive text,
  add column if not exists client_number text;

-- Título deixa de ser obrigatório (gerado automaticamente)
alter table public.proposals alter column title drop not null;

-- 2) Código da proposta = Nº do cliente + recorrência (.01 .02)
create or replace function public.tg_proposal_client_code()
returns trigger language plpgsql as $$
declare
  cn text;
  n  integer;
begin
  if new.client_id is null then
    return new;
  end if;

  select client_number into cn from public.clients where id = new.client_id;
  if cn is null then
    return new;
  end if;

  new.client_number := cn;

  if new.code is null or left(new.code, length(cn) + 1) <> cn || '.' then
    select count(*) + 1 into n
      from public.proposals
     where client_id = new.client_id
       and (tg_op = 'INSERT' or id <> new.id);
    new.code := cn || '.' || lpad(n::text, 2, '0');
  end if;

  if new.title is null or new.title = '' then
    new.title := case when new.proposal_kind = 'servico_privado'
                      then 'Serviço Privado ' || cn
                      else 'Roteiro Personalizado ' || cn end;
  end if;

  return new;
end $$;

drop trigger if exists tg_proposals_client_code on public.proposals;
create trigger tg_proposals_client_code
  before insert or update on public.proposals
  for each row execute function public.tg_proposal_client_code();

-- 3) Recorrência nos códigos da ordem de serviço --------------
alter table public.service_orders
  add column if not exists payment_terms text;

-- 4) Índices e grants ----------------------------------------
create index if not exists idx_proposals_client on public.proposals(client_id);
create index if not exists idx_proposals_kind on public.proposals(proposal_kind);

grant select, insert, update, delete on public.proposals to authenticated;
grant all on public.proposals to service_role;


-- =====================================================================
-- BLOCO V14 (supabase-migration-v14-delete-cascade.sql)
-- =====================================================================

-- V14 — Permitir eliminar clientes (e leads) sem violar chaves estrangeiras
-- Recria TODAS as foreign keys que apontam para public.clients com ON DELETE CASCADE.
-- Assim, ao remover um cliente, propostas, ordens de serviço, faturas, movimentos
-- e restantes registos dependentes são removidos automaticamente.

DO $$
DECLARE
  r record;
  cols text;
  refcols text;
BEGIN
  FOR r IN
    SELECT c.conname,
           c.conrelid::regclass AS tbl,
           c.oid
    FROM pg_constraint c
    WHERE c.confrelid = 'public.clients'::regclass
      AND c.contype = 'f'
      AND c.confdeltype <> 'c'
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY x.ord)
      INTO cols
    FROM unnest((SELECT conkey FROM pg_constraint WHERE oid = r.oid)) WITH ORDINALITY AS x(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = r.tbl::oid AND a.attnum = x.attnum;

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY x.ord)
      INTO refcols
    FROM unnest((SELECT confkey FROM pg_constraint WHERE oid = r.oid)) WITH ORDINALITY AS x(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = 'public.clients'::regclass AND a.attnum = x.attnum;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.clients (%s) ON DELETE CASCADE',
      r.tbl, r.conname, cols, refcols
    );
  END LOOP;
END $$;

-- Mesmo tratamento para leads (conversão/remoção de leads)
DO $$
DECLARE
  r record;
  cols text;
  refcols text;
BEGIN
  IF to_regclass('public.leads') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl, c.oid
    FROM pg_constraint c
    WHERE c.confrelid = 'public.leads'::regclass
      AND c.contype = 'f'
      AND c.confdeltype = 'a'
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY x.ord)
      INTO cols
    FROM unnest((SELECT conkey FROM pg_constraint WHERE oid = r.oid)) WITH ORDINALITY AS x(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = r.tbl::oid AND a.attnum = x.attnum;

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY x.ord)
      INTO refcols
    FROM unnest((SELECT confkey FROM pg_constraint WHERE oid = r.oid)) WITH ORDINALITY AS x(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = 'public.leads'::regclass AND a.attnum = x.attnum;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.leads (%s) ON DELETE SET NULL',
      r.tbl, r.conname, cols, refcols
    );
  END LOOP;
END $$;


-- =====================================================================
-- BLOCO V15 (supabase-migration-v15-lead-client-number.sql)
-- =====================================================================

-- ============================================================
-- Mtour v15 — Numeração única Lead/Cliente
-- O lead recebe já o próximo número de cliente (mesma sequência)
-- e mantém esse número quando é convertido em cliente.
-- Idempotente. Cole no SQL Editor do Supabase e execute.
-- ============================================================

-- 1) Garante a sequência e a função de numeração de cliente ----
create sequence if not exists public.seq_client start 1;

create or replace function public.next_client_number()
returns text language sql volatile as $$
  select 'C' || lpad(nextval('public.seq_client')::text, 5, '0')
$$;

-- 2) Alinha a sequência ao maior número já usado (clientes + leads)
do $$
declare mx bigint;
begin
  select coalesce(max(n), 0) into mx from (
    select nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint as n
      from public.clients where client_number ~ '^C[0-9]+$'
    union all
    select nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint
      from public.leads where client_number ~ '^C[0-9]+$'
  ) s;
  perform setval('public.seq_client', greatest(mx, 1), mx > 0);
end $$;

-- 3) Leads passam a usar a MESMA sequência dos clientes --------
alter table public.leads
  alter column client_number set default public.next_client_number();

-- Renumera leads com formato antigo (CLI-...) ou sem número
update public.leads
   set client_number = public.next_client_number()
 where client_number is null
    or client_number !~ '^C[0-9]+$';

-- 4) Ao converter, o cliente herda o número do lead ------------
create or replace function public.tg_client_number_from_lead()
returns trigger language plpgsql as $$
declare ln text;
begin
  if new.client_number is null and new.lead_id is not null then
    select client_number into ln from public.leads where id = new.lead_id;
    if ln is not null and not exists (select 1 from public.clients where client_number = ln) then
      new.client_number := ln;
    end if;
  end if;
  if new.client_number is null then
    new.client_number := public.next_client_number();
  end if;
  return new;
end $$;

drop trigger if exists tg_clients_number_from_lead on public.clients;
create trigger tg_clients_number_from_lead
  before insert on public.clients
  for each row execute function public.tg_client_number_from_lead();

create index if not exists idx_leads_client_number on public.leads(client_number);


-- =====================================================================
-- BLOCO V16 (supabase-migration-v16.sql)
-- =====================================================================

-- =====================================================================
-- MTOUR PORTUGAL — Migration v16 (Fase 1)
-- Reformulação: OS, Agenda, Logística, Cadastros, Financeiro, Comissões
-- Idempotente: pode ser executada mais do que uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MOTORISTAS
-- ---------------------------------------------------------------------
alter table public.drivers add column if not exists nif text;
alter table public.drivers add column if not exists address text;
alter table public.drivers add column if not exists criminal_record boolean default false;
alter table public.drivers add column if not exists criminal_record_expiry date;
alter table public.drivers add column if not exists id_document_type text;   -- cartao_cidadao | titulo_residencia | passaporte
alter table public.drivers add column if not exists id_document_number text;
alter table public.drivers add column if not exists id_document_expiry date;
alter table public.drivers add column if not exists contract_type text default 'contratado'; -- contratado | funcionario_fixo
alter table public.drivers add column if not exists commission_pct numeric(5,2) default 0;   -- 20 / 30 / 40 / 50

-- ---------------------------------------------------------------------
-- 2. FUNCIONÁRIOS
-- ---------------------------------------------------------------------
alter table public.employees add column if not exists nif text;
alter table public.employees add column if not exists address text;
alter table public.employees add column if not exists criminal_record boolean default false;
alter table public.employees add column if not exists criminal_record_expiry date;
alter table public.employees add column if not exists residence_permit_number text;
alter table public.employees add column if not exists residence_permit_expiry date;
alter table public.employees add column if not exists citizen_card_number text;
alter table public.employees add column if not exists citizen_card_expiry date;
alter table public.employees add column if not exists salary numeric(12,2) default 0;
alter table public.employees add column if not exists salary_pay_day int default 1;

-- ---------------------------------------------------------------------
-- 3. VEÍCULOS + ATRIBUIÇÃO DE MOTORISTAS
-- ---------------------------------------------------------------------
alter table public.vehicles add column if not exists usage_type text default 'proprio'; -- proprio | aluguel
alter table public.vehicles add column if not exists partner_id uuid references public.partners(id) on delete set null;
alter table public.vehicles add column if not exists owner_company text;
alter table public.vehicles add column if not exists rental_weekly_cost numeric(12,2) default 0;

create table if not exists public.vehicle_drivers (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id  uuid not null references public.drivers(id)  on delete cascade,
  is_primary boolean default false,
  created_at timestamptz default now(),
  unique (vehicle_id, driver_id)
);
grant select, insert, update, delete on public.vehicle_drivers to authenticated;
grant all on public.vehicle_drivers to service_role;
alter table public.vehicle_drivers enable row level security;
drop policy if exists "vd_auth_all" on public.vehicle_drivers;
create policy "vd_auth_all" on public.vehicle_drivers for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 4. FORNECEDORES / PARCEIROS
-- ---------------------------------------------------------------------
alter table public.suppliers add column if not exists company_name text;
alter table public.suppliers add column if not exists contact_person text;
alter table public.suppliers add column if not exists products_services text;
alter table public.suppliers add column if not exists phone_country text default 'PT';

alter table public.partners add column if not exists partner_type text;      -- hotel | restaurante | agencia | outro
alter table public.partners add column if not exists other_type_label text;
alter table public.partners add column if not exists contact_person text;
alter table public.partners add column if not exists phone_country text default 'PT';
alter table public.partners add column if not exists address text;

-- Migrar hotéis / restaurantes / agências para parceiros (uma só vez)
do $$
begin
  if to_regclass('public.hotels') is not null then
    insert into public.partners (name, partner_type, phone, email, address, contact_person, active)
    select h.name, 'hotel', h.phone, h.email, h.address, h.contact_person, coalesce(h.active,true)
    from public.hotels h
    where not exists (select 1 from public.partners p where p.name = h.name and p.partner_type = 'hotel');
  end if;
  if to_regclass('public.restaurants') is not null then
    insert into public.partners (name, partner_type, phone, email, address, active)
    select r.name, 'restaurante', r.phone, r.email, r.address, coalesce(r.active,true)
    from public.restaurants r
    where not exists (select 1 from public.partners p where p.name = r.name and p.partner_type = 'restaurante');
  end if;
  if to_regclass('public.agencies') is not null then
    insert into public.partners (name, partner_type, phone, email, nif, contact_person, commission_pct, active)
    select a.name, 'agencia', a.phone, a.email, a.nif, a.contact_person, a.commission_pct, coalesce(a.active,true)
    from public.agencies a
    where not exists (select 1 from public.partners p where p.name = a.name and p.partner_type = 'agencia');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. ESTADOS DA ORDEM DE SERVIÇO
-- ---------------------------------------------------------------------
delete from public.status_options where domain = 'oc_operational_status';
insert into public.status_options (domain, code, label, sort, active) values
  ('oc_operational_status','para_atendimento','Para Atendimento',1,true),
  ('oc_operational_status','em_atendimento','Em Atendimento',2,true),
  ('oc_operational_status','atendimento_finalizado','Atendimento Finalizado',3,true)
on conflict do nothing;

-- A coluna status é um enum antigo (service_status). Convertemos para texto
-- para permitir os novos estados geridos em status_options.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_orders'
      and column_name = 'status' and data_type = 'USER-DEFINED'
  ) then
    alter table public.service_orders alter column status drop default;
    alter table public.service_orders alter column status type text using status::text;
  end if;
end $$;

update public.service_orders set status = 'para_atendimento'
  where status in ('agendado','confirmado','motorista_designado','reagendado');
update public.service_orders set status = 'em_atendimento'
  where status in ('em_execucao','em_deslocacao','cliente_a_bordo');
update public.service_orders set status = 'atendimento_finalizado'
  where status in ('finalizado','no_show','nao_realizado','cancelado');

alter table public.service_orders alter column status set default 'para_atendimento';

-- ---------------------------------------------------------------------
-- 6. CATÁLOGO DE SERVIÇOS + ITENS DE PROPOSTA
-- ---------------------------------------------------------------------
insert into public.products_services (name, kind, active) values
  ('Receptivo no Aeroporto','servico',true),
  ('Receptivo + Roteiro Personalizado','servico',true),
  ('Transfer Hotel / Aeroporto','servico',true),
  ('Receptivo + Roteiro Personalizado + Transfer','servico',true),
  ('Serviço Privado','servico',true),
  ('Aluguel de carro','servico',true),
  ('Diária de motorista privado','servico',true),
  ('Diária de Guia de Turismo','servico',true),
  ('Passagens Aéreas','servico',true),
  ('Seguro Viagem','servico',true),
  ('Elaboração de Roteiros','servico',true),
  ('Compra de bilhetes','servico',true),
  ('Reserva de Hotéis','servico',true)
on conflict do nothing;

create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  product_id uuid references public.products_services(id) on delete set null,
  description text,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) generated always as (quantity * unit_price) stored,
  sort int default 0,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.proposal_items to authenticated;
grant all on public.proposal_items to service_role;
alter table public.proposal_items enable row level security;
drop policy if exists "pi_auth_all" on public.proposal_items;
create policy "pi_auth_all" on public.proposal_items for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 7. DESPESAS COM / SEM FATURA
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['service_expenses','tvde_expenses','cash_movements'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I add column if not exists has_invoice boolean default false', t);
      execute format('alter table public.%I add column if not exists invoice_number text', t);
      execute format('alter table public.%I add column if not exists no_invoice_reason text', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. CONTA CORRENTE — a pagar / a receber + custos fixos
-- ---------------------------------------------------------------------
alter table public.cash_movements add column if not exists direction text; -- a_pagar | a_receber | realizado
alter table public.cash_movements add column if not exists due_date date;
alter table public.cash_movements add column if not exists settled boolean default true;
alter table public.cash_movements add column if not exists source text;    -- manual | custo_fixo | salario | tvde | privado

update public.cash_movements
  set direction = case when kind = 'entrada' then 'a_receber' else 'a_pagar' end
  where direction is null;

create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  amount numeric(12,2) not null default 0,
  recurrence text not null default 'mensal',  -- semanal | quinzenal | mensal | anual
  start_date date not null default current_date,
  end_date date,
  due_day int default 1,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  has_invoice boolean default false,
  invoice_number text,
  no_invoice_reason text,
  active boolean default true,
  notes text,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.fixed_costs to authenticated;
grant all on public.fixed_costs to service_role;
alter table public.fixed_costs enable row level security;
drop policy if exists "fc_auth_all" on public.fixed_costs;
create policy "fc_auth_all" on public.fixed_costs for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 9. TURNOS — KM inicial herdado e edição de hora de fim só admin
-- ---------------------------------------------------------------------
alter table public.tvde_shifts add column if not exists end_time_edited_by uuid references auth.users(id);
alter table public.tvde_shifts add column if not exists end_time_edited_at timestamptz;

create or replace function public.last_end_km(_vehicle uuid, _before date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select km_final from public.tvde_shifts
      where vehicle_id = _vehicle and km_final is not null and shift_date < _before
      order by shift_date desc limit 1), 0);
$$;
grant execute on function public.last_end_km(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 10. COMISSÕES SEMANAIS POR VEÍCULO
-- ---------------------------------------------------------------------
create table if not exists public.commission_settlements (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  gross_income numeric(12,2) default 0,
  expenses numeric(12,2) default 0,
  net_profit numeric(12,2) default 0,
  commission_pct numeric(5,2) default 0,
  commission_amount numeric(12,2) default 0,
  rental_cost numeric(12,2) default 0,
  amount_due_driver numeric(12,2) default 0,
  amount_due_company numeric(12,2) default 0,
  paid boolean default false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique (week_start, vehicle_id, driver_id)
);
grant select, insert, update, delete on public.commission_settlements to authenticated;
grant all on public.commission_settlements to service_role;
alter table public.commission_settlements enable row level security;
drop policy if exists "cs_auth_all" on public.commission_settlements;
create policy "cs_auth_all" on public.commission_settlements for all to authenticated using (true) with check (true);

-- Resumo semanal por veículo (entradas − saídas)
create or replace view public.v_weekly_vehicle_result as
with earn as (
  select e.tvde_shift_id,
         sum(coalesce(e.gross,0)+coalesce(e.tips,0)+coalesce(e.bonus,0)) as gross,
         sum(coalesce(e.commissions,0)+coalesce(e.other_deductions,0))   as deductions
  from public.tvde_earnings e group by 1
), priv as (
  select p.tvde_shift_id, sum(coalesce(p.value,0)) as private_income
  from public.tvde_private_jobs p group by 1
), exp as (
  select x.tvde_shift_id, sum(coalesce(x.amount,0)) as expenses
  from public.service_expenses x where x.tvde_shift_id is not null group by 1
)
select
  date_trunc('week', s.shift_date)::date as week_start,
  (date_trunc('week', s.shift_date)::date + 6) as week_end,
  s.vehicle_id,
  s.driver_id,
  sum(coalesce(earn.gross,0) + coalesce(priv.private_income,0)) as gross_income,
  sum(coalesce(exp.expenses,0) + coalesce(earn.deductions,0))   as expenses,
  sum(coalesce(earn.gross,0) + coalesce(priv.private_income,0)
      - coalesce(exp.expenses,0) - coalesce(earn.deductions,0)) as net_profit
from public.tvde_shifts s
left join earn on earn.tvde_shift_id = s.id
left join priv on priv.tvde_shift_id = s.id
left join exp  on exp.tvde_shift_id  = s.id
group by 1,2,3,4;
grant select on public.v_weekly_vehicle_result to authenticated;

-- ---------------------------------------------------------------------
-- 11. PERFIS DE UTILIZADOR
-- ---------------------------------------------------------------------
-- Executar esta linha SOZINHA (ALTER TYPE ... ADD VALUE não corre dentro de bloco):
alter type public.app_role add value if not exists 'assistente';

-- =====================================================================
-- FIM v16
-- =====================================================================


-- =====================================================================
-- BLOCO V17 (supabase-migration-v17-regioes.sql)
-- =====================================================================

-- V17: Regiões como primeiro ponto de conexão dos Roteiros
-- Idempotente. Cole no SQL Editor do Supabase.

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean default true,
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.regions to authenticated;
grant all on public.regions to service_role;
alter table public.regions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='regions' and policyname='rg read') then
    create policy "rg read" on public.regions for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='regions' and policyname='rg write') then
    create policy "rg write" on public.regions for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='regions' and policyname='rg upd') then
    create policy "rg upd" on public.regions for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='regions' and policyname='rg del') then
    create policy "rg del" on public.regions for delete to authenticated using (true);
  end if;
end $$;

-- Semear regiões a partir dos roteiros existentes + regiões base
insert into public.regions (name)
select distinct region from public.tour_routes where region is not null and region <> ''
on conflict (name) do nothing;

insert into public.regions (name) values ('Lisboa'), ('Porto'), ('Algarve'), ('Madeira'), ('Açores')
on conflict (name) do nothing;

-- Roteiro associado à região
alter table public.tour_routes
  add column if not exists region_id uuid references public.regions(id) on delete set null;

update public.tour_routes t
   set region_id = r.id
  from public.regions r
 where t.region_id is null and t.region = r.name;

create index if not exists idx_tour_routes_region on public.tour_routes(region_id);

-- Proposta guarda a região escolhida
alter table public.proposals
  add column if not exists region_id uuid references public.regions(id) on delete set null;


-- =====================================================================
-- BLOCO V18 (supabase-migration-v18-orcamento-fluxo.sql)
-- =====================================================================

-- ============================================================
-- Mtour Portugal — v18
-- Aprovação de orçamento, bilhetes de acompanhamento,
-- estados financeiros da OS e permissões de motorista.
-- Idempotente: pode ser executado várias vezes.
-- ============================================================

-- 1) Orçamento / aprovação da proposta -----------------------
alter table public.proposals
  add column if not exists budget_status text default 'rascunho',
  add column if not exists budget_approved_at timestamptz,
  add column if not exists budget_receipt_info text,
  add column if not exists budget_analysis_at timestamptz,
  add column if not exists budget_refused_at timestamptz,
  add column if not exists budget_refusal_reason text;

-- 2) Bilhetes de acompanhamento (1 por dia até aprovar/recusar)
create table if not exists public.proposal_followups (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  due_date date not null,
  done boolean not null default false,
  note text,
  created_at timestamptz default now(),
  unique (proposal_id, due_date)
);

grant select, insert, update, delete on public.proposal_followups to authenticated;
grant all on public.proposal_followups to service_role;
alter table public.proposal_followups enable row level security;

drop policy if exists "pf read" on public.proposal_followups;
create policy "pf read" on public.proposal_followups for select to authenticated using (true);
drop policy if exists "pf write" on public.proposal_followups;
create policy "pf write" on public.proposal_followups for all to authenticated
  using (true) with check (true);

-- 3) Estados financeiros da Ordem de Serviço -----------------
insert into public.status_options (domain, code, label, sort) values
  ('oc_financial_status','pagar_empresa','Vai pagar a empresa',5),
  ('oc_financial_status','receber_maos','Receber em mãos',6),
  ('oc_financial_status','pago','Pago',30)
on conflict do nothing;

-- 4) Permissões: motorista só Voucher e TVDE -----------------
insert into public.role_permissions (role, module) values
  ('admin','voucher'),('comercial','voucher'),('administrativo','voucher'),('motorista','voucher'),
  ('motorista','tvde')
on conflict (role, module) do nothing;

delete from public.role_permissions
 where role = 'motorista' and module not in ('voucher','tvde');


-- =====================================================================
-- BLOCO V19 (supabase-migration-v19-proposta-simples.sql)
-- =====================================================================

-- V19: campo do serviço privado na proposta (idempotente)
alter table public.proposals
  add column if not exists private_service_text text;


-- =====================================================================
-- BLOCO V20 (supabase-migration-v20-client-number-curto.sql)
-- =====================================================================

-- ============================================================
-- Mtour v20 — Número de cliente curto (C01, C02, C03…)
-- Idempotente. Cole no SQL Editor do Supabase e execute.
-- ============================================================

-- 1) Nova formatação: 2 dígitos mínimos ----------------------
create or replace function public.next_client_number()
returns text language sql volatile as $$
  select 'C' || lpad(nextval('public.seq_client')::text, 2, '0')
$$;

-- 2) Reformata números existentes (remove zeros à frente) ----
update public.clients
   set client_number = 'C' || lpad(regexp_replace(client_number, '\D', '', 'g')::bigint::text, 2, '0')
 where client_number ~ '^C[0-9]+$';

update public.leads
   set client_number = 'C' || lpad(regexp_replace(client_number, '\D', '', 'g')::bigint::text, 2, '0')
 where client_number ~ '^C[0-9]+$';

-- 3) Realinha a sequência --------------------------------------
do $$
declare mx bigint;
begin
  select coalesce(max(n), 0) into mx from (
    select nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint as n
      from public.clients where client_number ~ '^C[0-9]+$'
    union all
    select nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint
      from public.leads where client_number ~ '^C[0-9]+$'
  ) s;
  perform setval('public.seq_client', greatest(mx, 1), mx > 0);
end $$;


-- =====================================================================
-- BLOCO V21 (supabase-migration-v21-cabecalho-documentos.sql)
-- =====================================================================

-- ============================================================
-- Mtour Portugal — v21
-- Cabeçalho dos documentos (Proposta / Orçamento / Voucher)
-- e lançamento automático do orçamento aprovado na conta corrente.
-- Idempotente.
-- ============================================================

-- 1) Cabeçalho comercial dos documentos ----------------------
alter table public.company_settings
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists doc_header_extra text,
  add column if not exists doc_footer text;

update public.company_settings
   set legal_name = coalesce(legal_name, 'Façanha Prospera Unipessoal Lda'),
       trade_name = coalesce(trade_name, 'Mtour Portugal'),
       address    = coalesce(address, 'Rua do Cabeço Marinho 35A'),
       postal_code = coalesce(postal_code, '2755-157'),
       city       = coalesce(city, 'Cascais'),
       nif        = coalesce(nif, '518415686'),
       phone      = coalesce(phone, '924060829'),
       email      = coalesce(email, 'marcelo25022023@gmail.com')
 where singleton is true;

-- 2) Ligação do movimento de caixa à proposta/orçamento ------
alter table public.cash_movements
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

create unique index if not exists cash_movements_proposal_budget_uidx
  on public.cash_movements (proposal_id)
  where proposal_id is not null;


-- =====================================================================
-- BLOCO V22 (supabase-migration-v22-validacao-documentos.sql)
-- =====================================================================

-- v22 — Validação de orçamento/voucher + condições de pagamento personalizadas
alter table public.proposals add column if not exists budget_validated_at timestamptz;
alter table public.proposals add column if not exists voucher_validated_at timestamptz;
alter table public.proposals add column if not exists payment_stages jsonb default '[]'::jsonb;

create index if not exists idx_proposals_budget_validated on public.proposals (budget_validated_at);
create index if not exists idx_proposals_voucher_validated on public.proposals (voucher_validated_at);

-- =====================================================================
-- FIM DO SCHEMA CONSOLIDADO (v22)
-- =====================================================================
