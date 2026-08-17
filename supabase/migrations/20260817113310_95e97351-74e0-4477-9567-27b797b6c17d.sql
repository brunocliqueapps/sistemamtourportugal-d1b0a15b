ALTER TABLE public.clients DISABLE TRIGGER tg_clients_lock_number;

WITH bad AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM public.clients
  WHERE client_number IS NOT NULL AND client_number !~ '^C[0-9]{1,4}$'
)
UPDATE public.clients c
SET client_number = 'C' || (99 + b.rn)::text
FROM bad b
WHERE c.id = b.id;

ALTER TABLE public.clients ENABLE TRIGGER tg_clients_lock_number;

SELECT setval('public.seq_client', GREATEST(
  (SELECT COALESCE(MAX((substring(client_number,2))::int),0) FROM public.clients WHERE client_number ~ '^C[0-9]{1,4}$'),
  (SELECT COALESCE(MAX((substring(client_number,2))::int),0) FROM public.leads WHERE client_number ~ '^C[0-9]{1,4}$')
), true);