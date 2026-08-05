-- Adiciona coluna para orientação de recebimento na Ordem de Serviço
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS financial_receipt_note text;

-- Garante que as opções de status financeiro padrão existem (se não vierem da tabela status_options)
-- As opções solicitadas são: Pagamento Padrão Mtour, Pagamento à Vista, Recebimento no Ato.
-- No código, o sistema usa a tabela status_options para popular esses selects.
-- Vamos garantir que essas opções existam para o domínio 'oc_financial_status'.

INSERT INTO public.status_options (domain, code, label, sort, active)
VALUES 
  ('oc_financial_status', 'padrao_mtour', 'Pagamento Padrão Mtour', 1, true),
  ('oc_financial_status', 'a_vista', 'Pagamento à Vista', 2, true),
  ('oc_financial_status', 'recebimento_ato', 'Recebimento no Ato', 3, true)
ON CONFLICT (domain, code) DO UPDATE SET 
  label = EXCLUDED.label,
  sort = EXCLUDED.sort,
  active = true;
