-- v7: Arquivar leads (retirar do pipeline mantendo na lista)
alter table public.leads
  add column if not exists archived boolean not null default false;

create index if not exists idx_leads_archived on public.leads(archived);
