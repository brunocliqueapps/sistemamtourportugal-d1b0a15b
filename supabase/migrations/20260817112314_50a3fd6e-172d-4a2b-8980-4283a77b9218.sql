-- Align sequence with real max number in clients/leads
SELECT setval('public.seq_client', GREATEST(
  COALESCE((SELECT MAX(substring(client_number FROM 2)::bigint) FROM public.clients WHERE client_number ~ '^C[0-9]+$'), 0),
  COALESCE((SELECT MAX(substring(client_number FROM 2)::bigint) FROM public.leads WHERE client_number ~ '^C[0-9]+$'), 0),
  1
), true);

CREATE OR REPLACE FUNCTION public.next_client_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  candidate text;
  n bigint;
  tries int := 0;
BEGIN
  LOOP
    tries := tries + 1;
    n := nextval('public.seq_client');
    candidate := 'C' || lpad(n::text, 2, '0');
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE client_number = candidate)
       AND NOT EXISTS (SELECT 1 FROM public.leads WHERE client_number = candidate) THEN
      RETURN candidate;
    END IF;
    IF tries > 500 THEN
      RETURN 'C' || to_char(now(), 'YYMMDDHH24MISS');
    END IF;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.next_client_number() TO authenticated, anon, service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.seq_client TO authenticated, anon, service_role;

CREATE INDEX IF NOT EXISTS idx_clients_client_number ON public.clients (client_number);
CREATE INDEX IF NOT EXISTS idx_leads_client_number ON public.leads (client_number);