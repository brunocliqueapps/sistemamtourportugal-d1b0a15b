-- 1) Função de numeração: nunca gera fallback com data
CREATE OR REPLACE FUNCTION public.next_client_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE mx bigint; n bigint;
BEGIN
  SELECT coalesce(max(num), 0) INTO mx FROM (
    SELECT nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint AS num
      FROM public.clients WHERE client_number ~ '^C[0-9]{1,5}$'
    UNION ALL
    SELECT nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint
      FROM public.leads WHERE client_number ~ '^C[0-9]{1,5}$'
  ) s;

  n := nextval('public.seq_client');
  IF n <= mx THEN
    n := mx + 1;
    PERFORM setval('public.seq_client', n, true);
  END IF;

  RETURN 'C' || lpad(n::text, 2, '0');
END;
$function$;

-- 2) Renumera os registos com número em formato de data
ALTER TABLE public.clients DISABLE TRIGGER tg_clients_lock_number;

WITH bad AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
    FROM public.clients
   WHERE client_number IS NOT NULL AND client_number !~ '^C[0-9]{1,5}$'
)
UPDATE public.clients c
   SET client_number = 'C' || (101 + bad.rn)::text
  FROM bad
 WHERE c.id = bad.id;

ALTER TABLE public.clients ENABLE TRIGGER tg_clients_lock_number;

-- 3) Realinha a sequência com o maior número válido
DO $$
DECLARE mx bigint;
BEGIN
  SELECT coalesce(max(num), 1) INTO mx FROM (
    SELECT nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint AS num
      FROM public.clients WHERE client_number ~ '^C[0-9]{1,5}$'
    UNION ALL
    SELECT nullif(regexp_replace(client_number, '\D', '', 'g'), '')::bigint
      FROM public.leads WHERE client_number ~ '^C[0-9]{1,5}$'
  ) s;
  PERFORM setval('public.seq_client', mx, true);
END $$;