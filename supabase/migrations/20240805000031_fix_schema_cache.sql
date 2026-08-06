-- Force schema cache refresh by re-adding columns if they somehow failed or missing in PostgREST cache
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'voucher_day_notes') THEN
        ALTER TABLE public.proposals ADD COLUMN voucher_day_notes JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'voucher_final_note') THEN
        ALTER TABLE public.proposals ADD COLUMN voucher_final_note TEXT;
    END IF;
END
$$;

-- Ensure grants are correct to help visibility
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
