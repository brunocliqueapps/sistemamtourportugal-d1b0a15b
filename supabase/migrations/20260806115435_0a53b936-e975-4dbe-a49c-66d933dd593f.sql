WITH ranked_roles AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id
           ORDER BY CASE WHEN role::text = 'admin' THEN 1 ELSE 0 END, id
         ) AS position
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked_roles rr
WHERE ur.id = rr.id
  AND rr.position > 1;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_key;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);