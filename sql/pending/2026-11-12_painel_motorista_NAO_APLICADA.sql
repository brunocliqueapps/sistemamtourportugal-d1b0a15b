-- CRM Mtour Portugal — campos dos serviços do motorista.
-- NÃO APLICADA. Execute no SQL Editor do Supabase após revisar.
-- Não cria Nova Venda nem altera telas ou permissões existentes.
-- Transação: qualquer erro desfaz esta execução inteira.
BEGIN;

ALTER TABLE public.tvde_shifts
  ADD COLUMN IF NOT EXISTS service_description text,
  ADD COLUMN IF NOT EXISTS total_revenue numeric CHECK (total_revenue >= 0),
  ADD COLUMN IF NOT EXISTS service_order_id uuid
    REFERENCES public.service_orders(id) ON DELETE SET NULL;

ALTER TABLE public.car_settlement_entries
  ADD COLUMN IF NOT EXISTS shift_id uuid
    REFERENCES public.tvde_shifts(id) ON DELETE CASCADE;

-- Impede duplicar o faturamento ao salvar ou editar o mesmo serviço.
CREATE UNIQUE INDEX IF NOT EXISTS car_settlement_entries_shift_id_unique
  ON public.car_settlement_entries (shift_id);

-- Usa as permissões de quem salva: não eleva privilégios do motorista.
CREATE OR REPLACE FUNCTION public.sync_driver_shift_revenue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.closed_at IS NOT NULL AND NEW.total_revenue IS NOT NULL
     AND NEW.vehicle_id IS NOT NULL
     AND NEW.operation_type::text IN ('tvde', 'privado') THEN
    INSERT INTO public.car_settlement_entries
      (shift_id, vehicle_id, week_start, entry_date, kind, amount,
       origin, description, created_by)
    VALUES
      (NEW.id, NEW.vehicle_id,
       date_trunc('week', NEW.shift_date::timestamp)::date,
       NEW.shift_date, 'entrada', NEW.total_revenue,
       CASE WHEN NEW.operation_type::text = 'tvde'
         THEN 'TVDE (Uber/Bolt)' ELSE 'Serviço privado' END,
       COALESCE(NULLIF(btrim(NEW.service_description), ''), 'Faturamento do serviço'),
       COALESCE((SELECT user_id FROM public.drivers WHERE id = NEW.driver_id), auth.uid()))
    ON CONFLICT (shift_id) DO UPDATE SET
      vehicle_id = EXCLUDED.vehicle_id,
      week_start = EXCLUDED.week_start,
      entry_date = EXCLUDED.entry_date,
      amount = EXCLUDED.amount,
      origin = EXCLUDED.origin,
      description = EXCLUDED.description;
  ELSE
    DELETE FROM public.car_settlement_entries WHERE shift_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER sync_driver_shift_revenue
  AFTER INSERT OR UPDATE ON public.tvde_shifts
  FOR EACH ROW EXECUTE FUNCTION public.sync_driver_shift_revenue();

COMMIT;

-- Conferência após aplicar (somente leitura): devem aparecer quatro campos.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'tvde_shifts'
        AND column_name IN ('service_description', 'total_revenue', 'service_order_id'))
       OR (table_name = 'car_settlement_entries' AND column_name = 'shift_id'))
ORDER BY table_name, column_name;