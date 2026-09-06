CREATE POLICY "car_entries_driver_insert" ON public.car_settlement_entries
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "car_entries_driver_update" ON public.car_settlement_entries
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "car_entries_driver_delete" ON public.car_settlement_entries
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());