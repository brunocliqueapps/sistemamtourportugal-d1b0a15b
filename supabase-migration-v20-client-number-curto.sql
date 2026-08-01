-- ============================================================
-- Mtour v20 — Número de cliente curto (C01, C02, C03…)
-- Idempotente. Cole no SQL Editor do Supabase e execute.
-- ============================================================

-- 1) Nova formatação: 2 dígitos mínimos ----------------------
create or replace function public.next_client_number()
returns text language sql volatile as $$
  select 'C' || lpad(nextval('public.seq_client')::text, 2, '0')
$$;

-- 2) Reformata números existentes (remove zeros à frente) ----
update public.clients
   set client_number = 'C' || lpad(regexp_replace(client_number, '\D', '', 'g')::bigint::text, 2, '0')
 where client_number ~ '^C[0-9]+$';

update public.leads
   set client_number = 'C' || lpad(regexp_replace(client_number, '\D', '', 'g')::bigint::text, 2, '0')
 where client_number ~ '^C[0-9]+$';

-- 3) Realinha a sequência --------------------------------------
do $$
declare mx bigint;
begin
  select coalesce(max(n), 0) into mx from (
    select nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint as n
      from public.clients where client_number ~ '^C[0-9]+$'
    union all
    select nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint
      from public.leads where client_number ~ '^C[0-9]+$'
  ) s;
  perform setval('public.seq_client', greatest(mx, 1), mx > 0);
end $$;
