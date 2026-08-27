ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS voucher_day_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS voucher_final_note text;