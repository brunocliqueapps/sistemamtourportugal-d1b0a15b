-- Migration v29: Commercial proposal settings (general conditions)
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS proposal_general_conditions TEXT;

COMMENT ON COLUMN public.company_settings.proposal_general_conditions IS 'General conditions text to be displayed at the bottom of commercial proposals';
