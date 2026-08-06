ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
CREATE POLICY "admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email), new.email)
  on conflict (id) do update set email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);
  if lower(new.email) = 'sistemamtour@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id,'admin') on conflict do nothing;
  end if;
  return new;
end $function$;

INSERT INTO public.profiles (id, full_name, email)
SELECT u.id,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
       u.email
  FROM auth.users u
ON CONFLICT (id) DO UPDATE SET email = excluded.email,
  full_name = coalesce(public.profiles.full_name, excluded.full_name);