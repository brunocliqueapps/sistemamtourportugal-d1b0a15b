-- V17: Regiões como primeiro ponto de conexão dos Roteiros
-- Idempotente. Cole no SQL Editor do Supabase.

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean default true,
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.regions to authenticated;
grant all on public.regions to service_role;
alter table public.regions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='regions' and policyname='rg read') then
    create policy "rg read" on public.regions for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='regions' and policyname='rg write') then
    create policy "rg write" on public.regions for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='regions' and policyname='rg upd') then
    create policy "rg upd" on public.regions for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='regions' and policyname='rg del') then
    create policy "rg del" on public.regions for delete to authenticated using (true);
  end if;
end $$;

-- Semear regiões a partir dos roteiros existentes + regiões base
insert into public.regions (name)
select distinct region from public.tour_routes where region is not null and region <> ''
on conflict (name) do nothing;

insert into public.regions (name) values ('Lisboa'), ('Porto'), ('Algarve'), ('Madeira'), ('Açores')
on conflict (name) do nothing;

-- Roteiro associado à região
alter table public.tour_routes
  add column if not exists region_id uuid references public.regions(id) on delete set null;

update public.tour_routes t
   set region_id = r.id
  from public.regions r
 where t.region_id is null and t.region = r.name;

create index if not exists idx_tour_routes_region on public.tour_routes(region_id);

-- Proposta guarda a região escolhida
alter table public.proposals
  add column if not exists region_id uuid references public.regions(id) on delete set null;
