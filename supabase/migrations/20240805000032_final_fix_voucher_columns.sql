-- Fix missing columns for proposals table and ensure they are visible to the Data API
DO $$
BEGIN
    -- Ensure voucher_final_note exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'proposals' AND column_name = 'voucher_final_note') THEN
        ALTER TABLE public.proposals ADD COLUMN voucher_final_note TEXT;
    END IF;

    -- Ensure voucher_day_notes exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'proposals' AND column_name = 'voucher_day_notes') THEN
        ALTER TABLE public.proposals ADD COLUMN voucher_day_notes JSONB DEFAULT '[]'::jsonb;
    END IF;
END
$$;

-- Grant permissions explicitly (Required for Supabase Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;

-- Force a schema reload hint by touching a comment
COMMENT ON TABLE public.proposals IS 'Proposals and itineraries for clients';
