-- v24 — Validação da Ordem de Serviço (lança o valor na conta corrente)
alter table public.service_orders add column if not exists validated_at timestamptz;

create index if not exists idx_service_orders_validated on public.service_orders (validated_at);

-- Evita movimentos duplicados por OS validada
create unique index if not exists cash_movements_so_validation_uidx
  on public.cash_movements (service_order_id)
  where service_order_id is not null and description like 'Orçamento validado%';
