CREATE INDEX IF NOT EXISTS idx_clients_client_number ON public.clients (client_number);
CREATE INDEX IF NOT EXISTS idx_leads_client_number ON public.leads (client_number);

CREATE OR REPLACE FUNCTION public.next_client_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  max_num bigint;
  candidate bigint;
  code text;
BEGIN
  SELECT COALESCE(MAX(n), 99) INTO max_num FROM (
    SELECT (substring(client_number from 2))::bigint AS n
      FROM public.clients
     WHERE client_number ~ '^C[0-9]{1,5}$'
    UNION ALL
    SELECT (substring(client_number from 2))::bigint AS n
      FROM public.leads
     WHERE client_number ~ '^C[0-9]{1,5}$'
  ) s;

  candidate := max_num;
  LOOP
    candidate := candidate + 1;
    code := 'C' || lpad(candidate::text, 2, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clients WHERE client_number = code)
          AND NOT EXISTS (SELECT 1 FROM public.leads WHERE client_number = code);
  END LOOP;

  PERFORM setval('public.seq_client', candidate, true);
  RETURN code;
END;
$function$;