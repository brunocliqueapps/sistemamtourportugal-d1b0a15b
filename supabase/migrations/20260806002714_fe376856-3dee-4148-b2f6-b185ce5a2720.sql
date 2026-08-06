create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'sistemamtour@gmail.com';

  if v_uid is null then
    v_uid := gen_random_uuid();

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'sistemamtour@gmail.com',
      extensions.crypt('Admin123!', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Administrador"}'::jsonb
    );

    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, 'email', v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', 'sistemamtour@gmail.com', 'email_verified', true, 'phone_verified', false),
      now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = extensions.crypt('Admin123!', extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_uid;
  end if;

  insert into public.user_roles (user_id, role)
  values (v_uid, 'admin')
  on conflict do nothing;
end $$;