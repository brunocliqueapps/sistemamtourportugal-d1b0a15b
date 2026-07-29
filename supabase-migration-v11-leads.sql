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
