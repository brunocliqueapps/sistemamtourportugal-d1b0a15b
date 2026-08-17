DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT GREATEST(
    COALESCE((SELECT MAX(substring(client_number FROM 2)::bigint) FROM public.clients WHERE client_number ~ '^C[0-9]+$'), 99),
    COALESCE((SELECT MAX(substring(client_number FROM 2)::bigint) FROM public.leads WHERE client_number ~ '^C[0-9]+$'), 99)
  ) INTO v_max;

  PERFORM setval('public.seq_client'::regclass, v_max, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.next_client_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'C' || nextval('public.seq_client'::regclass)::text;
$$;

REVOKE ALL ON FUNCTION public.next_client_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_client_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_client_number() TO service_role;
REVOKE ALL ON SEQUENCE public.seq_client FROM PUBLIC, anon;
GRANT USAGE, SELECT ON SEQUENCE public.seq_client TO authenticated;
GRANT ALL ON SEQUENCE public.seq_client TO service_role;