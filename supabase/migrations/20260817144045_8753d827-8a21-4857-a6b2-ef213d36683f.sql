CREATE OR REPLACE FUNCTION public.next_client_number()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_number bigint;
  candidate_code text;
BEGIN
  LOOP
    candidate_number := nextval('public.seq_client');
    candidate_code := 'C' || lpad(candidate_number::text, 2, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.clients WHERE client_number = candidate_code
      UNION ALL
      SELECT 1 FROM public.leads WHERE client_number = candidate_code
    );
  END LOOP;

  RETURN candidate_code;
END;
$$;

SELECT setval(
  'public.seq_client',
  GREATEST(
    COALESCE((SELECT max(substring(client_number FROM 2)::bigint) FROM public.clients WHERE client_number ~ '^C[0-9]{1,5}$'), 0),
    COALESCE((SELECT max(substring(client_number FROM 2)::bigint) FROM public.leads WHERE client_number ~ '^C[0-9]{1,5}$'), 0),
    1
  ),
  true
);

ALTER TABLE public.clients ALTER COLUMN client_number SET DEFAULT public.next_client_number();
ALTER TABLE public.leads ALTER COLUMN client_number SET DEFAULT public.next_client_number();

GRANT USAGE, SELECT ON SEQUENCE public.seq_client TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_client_number() TO authenticated;
GRANT ALL ON SEQUENCE public.seq_client TO service_role;
GRANT EXECUTE ON FUNCTION public.next_client_number() TO service_role;