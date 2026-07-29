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
do $$
begin
  if not exists (select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
                 where t.typname = 'app_role' and e.enumlabel = 'assistente') then
    alter type public.app_role add value 'assistente';
  end if;
end $$;

-- =====================================================================
-- FIM v16
-- =====================================================================
