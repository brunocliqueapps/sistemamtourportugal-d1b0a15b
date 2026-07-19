-- =====================================================================
-- Migration V4 · Mtour Portugal CRM
-- - Adiciona tipo de serviço nas Ordens de Serviço
-- =====================================================================

alter table public.service_orders
  add column if not exists operation_type public.operation_type default 'privado';

comment on column public.service_orders.operation_type is 'Tipo de serviço: privado, tvde, interno, outro';
