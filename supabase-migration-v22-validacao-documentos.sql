-- v22 — Validação de orçamento/voucher + condições de pagamento personalizadas
alter table public.proposals add column if not exists budget_validated_at timestamptz;
alter table public.proposals add column if not exists voucher_validated_at timestamptz;
alter table public.proposals add column if not exists payment_stages jsonb default '[]'::jsonb;

create index if not exists idx_proposals_budget_validated on public.proposals (budget_validated_at);
create index if not exists idx_proposals_voucher_validated on public.proposals (voucher_validated_at);
