-- V6: Roteiros (tour routes) + proposal type/roteiro linkage
-- Idempotente. Cole no SQL Editor do Supabase.

create table if not exists public.tour_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,          -- Lisboa, Porto, etc.
  description text,
  default_price numeric(12,2),
  duration_hours numeric(6,2),
  active boolean default true,
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.tour_routes to authenticated;
grant all on public.tour_routes to service_role;
alter table public.tour_routes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='tour_routes' and policyname='tr read') then
    create policy "tr read" on public.tour_routes for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tour_routes' and policyname='tr write') then
    create policy "tr write" on public.tour_routes for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tour_routes' and policyname='tr upd') then
    create policy "tr upd" on public.tour_routes for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tour_routes' and policyname='tr del') then
    create policy "tr del" on public.tour_routes for delete to authenticated using (public.is_admin(auth.uid()));
  end if;
end $$;

-- Ligar propostas a roteiros
alter table public.proposals
  add column if not exists proposal_type text default 'servico',   -- 'servico' | 'roteiro' | 'transfer' | 'outro'
  add column if not exists tour_route_id uuid references public.tour_routes(id),
  add column if not exists tour_route_custom text;

-- Seeds (não duplica pelo nome)
insert into public.tour_routes (name, region) values
  ('City Tour por Lisboa', 'Lisboa'),
  ('Bate-Volta a partir de Lisboa: Sintra, Azenhas do Mar, Cabo da Roca e Cascais', 'Lisboa'),
  ('Bate-Volta a partir de Lisboa: Fátima, Nazaré e Óbidos', 'Lisboa'),
  ('Bate-Volta a partir de Lisboa: Évora + Vinícola + Freeport', 'Lisboa'),
  ('Roteiros Personalizados em Lisboa', 'Lisboa'),
  ('Bate-Volta a partir do Porto: Braga e Guimarães', 'Porto'),
  ('Bate-Volta a partir do Porto: Região do Douro', 'Porto'),
  ('Bate-Volta a partir do Porto: Coimbra e Aveiro', 'Porto'),
  ('Bate-Volta a partir do Porto: Santiago de Compostela e a Catedral (Espanha)', 'Porto')
on conflict do nothing;
