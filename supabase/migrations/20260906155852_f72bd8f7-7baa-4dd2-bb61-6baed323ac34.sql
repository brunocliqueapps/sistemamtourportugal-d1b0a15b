INSERT INTO public.role_permissions (role, module) VALUES
  ('admin','acerto_carro'),
  ('admin','painel_motorista'),
  ('motorista','acerto_carro'),
  ('motorista','painel_motorista'),
  ('motorista','operacao'),
  ('motorista','voucher')
ON CONFLICT DO NOTHING;