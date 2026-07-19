-- ============================================================
-- MTOUR — Migration v5
-- Alertas de documentos e vencimentos da empresa
-- ============================================================

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'documento',
  -- categorias sugeridas: seguro, licenca, taxa, imposto, alvara, certidao,
  --                      contrato, documento, veiculo, outro
  entity text,                  -- ex.: "Empresa", "Frota", ou nome do fornecedor
  document_number text,
  issuer text,                  -- entidade emissora
  amount numeric(12,2),         -- valor (quando aplicável: taxa/seguro)
  currency text default 'EUR',
  issue_date date,
  due_date date not null,
  reminder_days integer not null default 30,
  status text not null default 'ativo',   -- ativo | pago | renovado | expirado | cancelado
  responsible text,             -- responsável interno
  attachment_url text,          -- link para o ficheiro (Storage)
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null
);

grant select, insert, update, delete on public.company_documents to authenticated;
grant all on public.company_documents to service_role;

alter table public.company_documents enable row level security;

drop policy if exists "company_documents read" on public.company_documents;
create policy "company_documents read"
  on public.company_documents for select
  to authenticated using (true);

drop policy if exists "company_documents write" on public.company_documents;
create policy "company_documents write"
  on public.company_documents for all
  to authenticated using (true) with check (true);

create index if not exists company_documents_due_date_idx
  on public.company_documents (due_date);
create index if not exists company_documents_status_idx
  on public.company_documents (status);

-- Registar o módulo no controlo de permissões (admin sempre tem acesso)
insert into public.role_permissions (role, module) values
  ('administrativo', 'alertas')
on conflict do nothing;
