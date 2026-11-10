-- Details entered by the driver, retained when reopening a daily service.
ALTER TABLE public.tvde_shifts
  ADD COLUMN service_description text,
  ADD COLUMN total_revenue numeric CHECK (total_revenue >= 0),
  ADD COLUMN service_order_id uuid REFERENCES public.service_orders(id) ON DELETE SET NULL;

-- One revenue entry per closed shift; edits update it instead of duplicating it.
ALTER TABLE public.car_settlement_entries
  ADD COLUMN shift_id uuid UNIQUE REFERENCES public.tvde_shifts(id) ON DELETE CASCADE;

CREATE FUNCTION public.sync_driver_shift_revenue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.closed_at IS NOT NULL AND NEW.total_revenue IS NOT NULL
     AND NEW.vehicle_id IS NOT NULL AND NEW.operation_type::text IN ('tvde', 'privado') THEN
    INSERT INTO public.car_settlement_entries
      (shift_id, vehicle_id, week_start, entry_date, kind, amount, origin, description, created_by)
    VALUES
      (NEW.id, NEW.vehicle_id, date_trunc('week', NEW.shift_date::timestamp)::date,
       NEW.shift_date, 'entrada', NEW.total_revenue,
       CASE WHEN NEW.operation_type::text = 'tvde' THEN 'TVDE (Uber/Bolt)' ELSE 'Serviço privado' END,
       COALESCE(NEW.service_description, 'Faturamento do serviço'),
       COALESCE((SELECT user_id FROM public.drivers WHERE id = NEW.driver_id), auth.uid()))
    ON CONFLICT (shift_id) DO UPDATE SET
      vehicle_id = EXCLUDED.vehicle_id, week_start = EXCLUDED.week_start,
      entry_date = EXCLUDED.entry_date, amount = EXCLUDED.amount,
      origin = EXCLUDED.origin, description = EXCLUDED.description;
  ELSE
    DELETE FROM public.car_settlement_entries WHERE shift_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_driver_shift_revenue
AFTER INSERT OR UPDATE ON public.tvde_shifts
FOR EACH ROW EXECUTE FUNCTION public.sync_driver_shift_revenue();
