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
