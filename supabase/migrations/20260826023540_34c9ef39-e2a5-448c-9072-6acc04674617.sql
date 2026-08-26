CREATE TABLE public.car_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  income_tvde numeric NOT NULL DEFAULT 0,
  income_services numeric NOT NULL DEFAULT 0,
  income_manual numeric NOT NULL DEFAULT 0,
  expenses_total numeric NOT NULL DEFAULT 0,
  rental_cost numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  driver_pct numeric,
  driver_amount numeric NOT NULL DEFAULT 0,
  company_amount numeric NOT NULL DEFAULT 0,
  details text,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.car_settlements TO authenticated;
GRANT ALL ON public.car_settlements TO service_role;
ALTER TABLE public.car_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "car_settlements_select_staff" ON public.car_settlements
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_module(auth.uid(), 'conta_corrente')
    OR public.has_module(auth.uid(), 'tvde')
    OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = car_settlements.driver_id AND d.user_id = auth.uid())
  );

CREATE POLICY "car_settlements_admin_write" ON public.car_settlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tg_car_settlements_upd BEFORE UPDATE ON public.car_settlements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_car_settlements_week ON public.car_settlements(week_start);
CREATE INDEX idx_car_settlements_vehicle ON public.car_settlements(vehicle_id);

CREATE TABLE public.car_settlement_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  kind text NOT NULL DEFAULT 'entrada',
  amount numeric NOT NULL DEFAULT 0,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.car_settlement_entries TO authenticated;
GRANT ALL ON public.car_settlement_entries TO service_role;
ALTER TABLE public.car_settlement_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "car_entries_select_auth" ON public.car_settlement_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "car_entries_admin_write" ON public.car_settlement_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_car_entries_week ON public.car_settlement_entries(vehicle_id, week_start);