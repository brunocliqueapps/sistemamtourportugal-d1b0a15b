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

CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'novo',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    status TEXT DEFAULT 'agendado',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT,
    series TEXT,
    kind TEXT,
    doc_type TEXT,
    issue_date DATE,
    due_date DATE,
    entity_name TEXT,
    total_value NUMERIC(15,2),
    status TEXT,
    cost_center_id UUID,
    payment_method_id UUID,
    vat_rate_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    entity TEXT NOT NULL,
    due_date DATE,
    reminder_days INTEGER DEFAULT 30,
    status TEXT DEFAULT 'ativo',
    currency TEXT DEFAULT 'EUR',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vat_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    rate NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grant permissions (CRITICAL for Lovable Cloud / Supabase Data API)
GRANT ALL ON public.company_settings TO authenticated, service_role;
GRANT ALL ON public.proposals TO authenticated, service_role;
GRANT ALL ON public.clients TO authenticated, service_role;
GRANT ALL ON public.leads TO authenticated, service_role;
GRANT ALL ON public.service_orders TO authenticated, service_role;
GRANT ALL ON public.invoices TO authenticated, service_role;
GRANT ALL ON public.company_documents TO authenticated, service_role;
GRANT ALL ON public.regions TO authenticated, service_role;
GRANT ALL ON public.vehicles TO authenticated, service_role;
GRANT ALL ON public.drivers TO authenticated, service_role;
GRANT ALL ON public.vehicle_drivers TO authenticated, service_role;
GRANT ALL ON public.cost_centers TO authenticated, service_role;
GRANT ALL ON public.payment_methods TO authenticated, service_role;
GRANT ALL ON public.vat_rates TO authenticated, service_role;

GRANT SELECT ON public.company_settings TO anon;
GRANT SELECT ON public.proposals TO anon;
GRANT SELECT ON public.clients TO anon;
GRANT SELECT ON public.leads TO anon;
GRANT SELECT ON public.service_orders TO anon;
GRANT SELECT ON public.invoices TO anon;
GRANT SELECT ON public.company_documents TO anon;
GRANT SELECT ON public.regions TO anon;
GRANT SELECT ON public.vehicles TO anon;
GRANT SELECT ON public.drivers TO anon;
GRANT SELECT ON public.vehicle_drivers TO anon;
GRANT SELECT ON public.cost_centers TO anon;
GRANT SELECT ON public.payment_methods TO anon;
GRANT SELECT ON public.vat_rates TO anon;

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vat_rates ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies
CREATE POLICY "Public read company settings" ON public.company_settings FOR SELECT USING (true);
CREATE POLICY "Admin manage company settings" ON public.company_settings FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can manage proposals" ON public.proposals FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read proposals" ON public.proposals FOR SELECT USING (true);

CREATE POLICY "Users can manage clients" ON public.clients FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read clients" ON public.clients FOR SELECT USING (true);

CREATE POLICY "Users can manage leads" ON public.leads FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read leads" ON public.leads FOR SELECT USING (true);

CREATE POLICY "Users can manage service_orders" ON public.service_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read service_orders" ON public.service_orders FOR SELECT USING (true);

CREATE POLICY "Users can manage invoices" ON public.invoices FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read invoices" ON public.invoices FOR SELECT USING (true);

CREATE POLICY "Users can manage company_documents" ON public.company_documents FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read company_documents" ON public.company_documents FOR SELECT USING (true);

CREATE POLICY "Users can manage regions" ON public.regions FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read regions" ON public.regions FOR SELECT USING (true);

CREATE POLICY "Users can manage vehicles" ON public.vehicles FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read vehicles" ON public.vehicles FOR SELECT USING (true);

CREATE POLICY "Users can manage drivers" ON public.drivers FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read drivers" ON public.drivers FOR SELECT USING (true);

CREATE POLICY "Users can manage vehicle_drivers" ON public.vehicle_drivers FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read vehicle_drivers" ON public.vehicle_drivers FOR SELECT USING (true);

CREATE POLICY "Users can manage cost_centers" ON public.cost_centers FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read cost_centers" ON public.cost_centers FOR SELECT USING (true);

CREATE POLICY "Users can manage payment_methods" ON public.payment_methods FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read payment_methods" ON public.payment_methods FOR SELECT USING (true);

CREATE POLICY "Users can manage vat_rates" ON public.vat_rates FOR ALL TO authenticated USING (true);
CREATE POLICY "Public read vat_rates" ON public.vat_rates FOR SELECT USING (true);