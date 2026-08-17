create or replace function public.next_client_number()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  candidate text;
  guard int := 0;
begin
  loop
    guard := guard + 1;
    candidate := 'C' || lpad(nextval('public.seq_client')::text, 2, '0');
    exit when not exists (select 1 from public.clients where client_number = candidate)
              and not exists (select 1 from public.leads where client_number = candidate);
    if guard > 10000 then
      raise exception 'Não foi possível gerar um número de cliente único';
    end if;
  end loop;
  return candidate;
end $$;

-- realinha a sequência com o maior número já usado
select setval('public.seq_client', greatest(
  coalesce((select max((regexp_replace(client_number, '\D', '', 'g'))::bigint) from public.clients where client_number ~ '\d'), 0),
  coalesce((select max((regexp_replace(client_number, '\D', '', 'g'))::bigint) from public.leads where client_number ~ '\d'), 0),
  1
));