UPDATE public.clients c
SET client_number = 'C100'
WHERE c.client_number = (
  SELECT client_number FROM public.clients
  WHERE client_number !~ '^C[0-9]{1,4}$' AND client_number IS NOT NULL
  ORDER BY created_at DESC LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM public.clients x WHERE x.client_number = 'C100');

SELECT setval('public.seq_client', 100, true);