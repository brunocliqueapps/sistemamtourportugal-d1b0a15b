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
