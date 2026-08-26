ALTER TABLE public.car_settlement_entries
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id),
  ADD COLUMN IF NOT EXISTS other_label text,
  ADD COLUMN IF NOT EXISTS invoice_number text;