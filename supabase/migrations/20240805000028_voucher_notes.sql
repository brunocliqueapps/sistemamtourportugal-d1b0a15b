
-- Migration v28: Voucher Day Notes and Final Note
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS voucher_final_note TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS voucher_day_notes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.proposals.voucher_final_note IS 'Final note for the voucher document';
COMMENT ON COLUMN public.proposals.voucher_day_notes IS 'Specific orientations for each day of the itinerary in the voucher';
