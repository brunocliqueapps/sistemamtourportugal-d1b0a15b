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
