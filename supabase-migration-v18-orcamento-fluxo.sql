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
