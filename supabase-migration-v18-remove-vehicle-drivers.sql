-- v18: remover a secção "Motoristas atribuídos" (tabela vehicle_drivers)
drop policy if exists "vd_auth_all" on public.vehicle_drivers;
drop table if exists public.vehicle_drivers cascade;
