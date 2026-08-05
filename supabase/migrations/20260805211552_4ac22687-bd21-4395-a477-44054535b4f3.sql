ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS voucher_day_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS voucher_final_note text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;

COMMENT ON COLUMN public.proposals.voucher_day_notes IS 'Orientações específicas do voucher organizadas por dia do roteiro';
COMMENT ON COLUMN public.proposals.voucher_final_note IS 'Nota final apresentada no voucher';

NOTIFY pgrst, 'reload schema';