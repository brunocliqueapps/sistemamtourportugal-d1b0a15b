-- ============================================================
-- Mtour v25 — Origem do Lead com descrição + Status do Lead
-- Idempotente. Cole no SQL Editor do Supabase e execute.
-- ============================================================

alter table public.leads
  add column if not exists origin_detail text;

alter table public.clients
  add column if not exists origin_detail text;

-- Status do Lead: novo | frio | morno | quente
alter table public.leads
  alter column temperature set default 'novo';
