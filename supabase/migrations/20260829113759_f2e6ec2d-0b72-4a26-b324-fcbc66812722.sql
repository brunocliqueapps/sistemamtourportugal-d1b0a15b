alter table public.proposals
  add column if not exists budget_saved_at timestamptz,
  add column if not exists roteiro_saved_at timestamptz,
  add column if not exists roteiro_validated_at timestamptz;

create index if not exists idx_proposals_budget_saved on public.proposals (budget_saved_at);
create index if not exists idx_proposals_roteiro_saved on public.proposals (roteiro_saved_at);
create index if not exists idx_proposals_roteiro_validated on public.proposals (roteiro_validated_at);

-- Marca como salvo/validado o que já existe, para não perder histórico
update public.proposals set budget_saved_at = coalesce(budget_saved_at, budget_validated_at) where budget_validated_at is not null;
update public.proposals set roteiro_saved_at = coalesce(roteiro_saved_at, created_at) where roteiro_saved_at is null;