-- V9: Tipo de proposta/operação gerido em Configurações (Admin)
-- Idempotente. Cole no SQL Editor do Supabase.

insert into public.status_options (domain, code, label, sort) values
  ('operation_type','privado','Privado',10),
  ('operation_type','tvde','TVDE',20),
  ('operation_type','interno','Interno',30),
  ('operation_type','servico','Serviço',40),
  ('operation_type','roteiro','Roteiro',50),
  ('operation_type','transfer','Transfer',60),
  ('operation_type','outro','Outro',99)
on conflict (domain, code) do nothing;
