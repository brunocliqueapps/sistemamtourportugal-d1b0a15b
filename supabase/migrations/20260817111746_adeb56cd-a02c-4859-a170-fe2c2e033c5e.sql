CREATE OR REPLACE FUNCTION public.next_client_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number bigint;
  candidate text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.next_client_number'));

  SELECT COALESCE(MAX(number_value), 0) + 1
    INTO next_number
  FROM (
    SELECT CASE
      WHEN client_number ~ '^C[0-9]+$'
      THEN substring(client_number FROM 2)::bigint
      ELSE NULL
    END AS number_value
    FROM public.clients
    UNION ALL
    SELECT CASE
      WHEN client_number ~ '^C[0-9]+$'
      THEN substring(client_number FROM 2)::bigint
      ELSE NULL
    END AS number_value
    FROM public.leads
  ) existing_numbers;

  LOOP
    candidate := 'C' || lpad(next_number::text, 2, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.clients WHERE client_number = candidate
    ) AND NOT EXISTS (
      SELECT 1 FROM public.leads WHERE client_number = candidate
    );

    next_number := next_number + 1;
  END LOOP;

  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.next_client_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_client_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_client_number() TO service_role;

SELECT setval(
  'public.seq_client',
  GREATEST(
    COALESCE((
      SELECT MAX(substring(client_number FROM 2)::bigint)
      FROM public.clients
      WHERE client_number ~ '^C[0-9]+$'
    ), 0),
    COALESCE((
      SELECT MAX(substring(client_number FROM 2)::bigint)
      FROM public.leads
      WHERE client_number ~ '^C[0-9]+$'
    ), 0),
    1
  ),
  true
);