-- Migração aditiva: Identificação do Cliente e Responsável pelo pagamento.
-- Compatível com registos antigos (colunas opcionais; NULL = Cliente Mtour). Não reclassifica dados.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_identification text,
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS payment_responsible text,
  ADD COLUMN IF NOT EXISTS payment_responsible_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;

-- Validação por trigger (em vez de CHECK) para manter compatibilidade.
CREATE OR REPLACE FUNCTION public.tg_validate_client_identification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_identification IS NOT NULL AND NEW.client_identification NOT IN ('mtour','parceiro') THEN
    RAISE EXCEPTION 'Identificação do cliente inválida';
  END IF;
  IF NEW.client_identification = 'parceiro' AND NEW.partner_id IS NULL THEN
    RAISE EXCEPTION 'Cliente Parceiro exige parceiro';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_client_identification ON public.clients;
CREATE TRIGGER validate_client_identification BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_client_identification();

CREATE OR REPLACE FUNCTION public.tg_validate_payment_responsible()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.payment_responsible IS NOT NULL AND NEW.payment_responsible NOT IN ('cliente','parceiro') THEN
    RAISE EXCEPTION 'Responsável pelo pagamento inválido';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_payment_responsible ON public.proposals;
CREATE TRIGGER validate_payment_responsible BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_payment_responsible();
