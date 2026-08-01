-- V19: campo do serviço privado na proposta (idempotente)
alter table public.proposals
  add column if not exists private_service_text text;
