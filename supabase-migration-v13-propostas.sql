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
