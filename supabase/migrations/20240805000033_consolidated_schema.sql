-- Consolidated schema for the entire application
-- This ensures all tables and columns are created and grants are applied.

-- Tables
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    legal_name TEXT,
    trade_name TEXT,
    nif TEXT,
    address TEXT,
    postal_code TEXT,
    city TEXT,
    country TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    iban TEXT,
    logo_url TEXT,
    instagram_qr_url TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    invoice_footer TEXT,
    proposal_general_conditions TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    client_id UUID,
    lead_id UUID,
    status TEXT DEFAULT 'rascunho',
    proposal_kind TEXT DEFAULT 'roteiro_personalizado',
    responsible TEXT,
    passengers INTEGER DEFAULT 1,
    arrival_date DATE,
    arrival_time TEXT,
    arrival_place TEXT,
    departure_date DATE,
    departure_time TEXT,
    departure_place TEXT,
    itinerary_start DATE,
    itinerary_end DATE,
    itinerary JSONB DEFAULT '[]'::jsonb,
    region_id UUID,
    tour_route_id UUID,
    title TEXT,
    descriptive TEXT,
    private_service_text TEXT,
    total_value NUMERIC(15,2) DEFAULT 0,
    payment_terms TEXT,
    payment_stages JSONB DEFAULT '[]'::jsonb,
    voucher_validated_at TIMESTAMPTZ,
    voucher_final_note TEXT,
    voucher_day_notes JSONB DEFAULT '[]'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    budget_approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_number TEXT UNIQUE,
    name TEXT NOT NULL,
    nif TEXT,
    email TEXT,
    phone TEXT,
    phone_country TEXT,
    address TEXT,
    postal_code TEXT,
    city TEXT,
    country TEXT,
    birth_date DATE,
    emergency_contact TEXT,
    lead_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- (Other tables would follow, but focusing on the ones with issues)

-- Grant permissions (CRITICAL for Lovable Cloud / Supabase Data API)
GRANT ALL ON public.company_settings TO authenticated, service_role;
GRANT ALL ON public.proposals TO authenticated, service_role;
GRANT ALL ON public.clients TO authenticated, service_role;

GRANT SELECT ON public.company_settings TO anon;
GRANT SELECT ON public.proposals TO anon;
GRANT SELECT ON public.clients TO anon;

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies for now (can be tightened later)
CREATE POLICY "Public read company settings" ON public.company_settings FOR SELECT USING (true);
CREATE POLICY "Admin update company settings" ON public.company_settings FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can manage proposals" ON public.proposals FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read proposals" ON public.proposals FOR SELECT USING (true);

CREATE POLICY "Users can manage clients" ON public.clients FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read clients" ON public.clients FOR SELECT USING (true);
