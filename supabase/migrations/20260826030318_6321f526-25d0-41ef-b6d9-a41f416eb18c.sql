ALTER TABLE public.car_settlement_entries
  ADD COLUMN IF NOT EXISTS entry_date date;

UPDATE public.car_settlement_entries
  SET entry_date = (created_at AT TIME ZONE 'UTC')::date
  WHERE entry_date IS NULL;

ALTER TABLE public.car_settlement_entries
  ALTER COLUMN entry_date SET DEFAULT CURRENT_DATE;