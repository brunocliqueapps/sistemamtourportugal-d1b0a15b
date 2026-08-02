-- v23 — Informações da análise do orçamento
alter table public.proposals add column if not exists budget_analysis_info text;
