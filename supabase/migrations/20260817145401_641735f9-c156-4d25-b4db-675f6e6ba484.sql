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