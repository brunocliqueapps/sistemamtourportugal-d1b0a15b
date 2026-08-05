-- v26: pipeline (kanban), arquivamento e temperatura nos clientes
alter table public.clients add column if not exists status text default 'novo';
alter table public.clients add column if not exists temperature text default 'novo';
alter table public.clients add column if not exists archived boolean default false;
alter table public.clients add column if not exists lost_reason text;

create index if not exists idx_clients_status on public.clients (status);
create index if not exists idx_clients_archived on public.clients (archived);

grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
