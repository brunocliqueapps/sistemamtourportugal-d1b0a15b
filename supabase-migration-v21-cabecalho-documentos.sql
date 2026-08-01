-- ============================================================
-- Mtour Portugal — v21
-- Cabeçalho dos documentos (Proposta / Orçamento / Voucher)
-- e lançamento automático do orçamento aprovado na conta corrente.
-- Idempotente.
-- ============================================================

-- 1) Cabeçalho comercial dos documentos ----------------------
alter table public.company_settings
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists doc_header_extra text,
  add column if not exists doc_footer text;

update public.company_settings
   set legal_name = coalesce(legal_name, 'Façanha Prospera Unipessoal Lda'),
       trade_name = coalesce(trade_name, 'Mtour Portugal'),
       address    = coalesce(address, 'Rua do Cabeço Marinho 35A'),
       postal_code = coalesce(postal_code, '2755-157'),
       city       = coalesce(city, 'Cascais'),
       nif        = coalesce(nif, '518415686'),
       phone      = coalesce(phone, '924060829'),
       email      = coalesce(email, 'marcelo25022023@gmail.com')
 where singleton is true;

-- 2) Ligação do movimento de caixa à proposta/orçamento ------
alter table public.cash_movements
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

create unique index if not exists cash_movements_proposal_budget_uidx
  on public.cash_movements (proposal_id)
  where proposal_id is not null;
