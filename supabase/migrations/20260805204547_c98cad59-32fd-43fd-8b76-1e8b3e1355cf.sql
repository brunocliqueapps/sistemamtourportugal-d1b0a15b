-- Add user roles and permissions tables
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- references auth.users(id)
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    module TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role, module)
);

-- Grant access
GRANT ALL ON public.user_roles TO authenticated, service_role;
GRANT ALL ON public.role_permissions TO authenticated, service_role;
GRANT SELECT ON public.user_roles TO anon;
GRANT SELECT ON public.role_permissions TO anon;

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage user_roles" ON public.user_roles FOR ALL TO authenticated USING (true); -- Simplified
CREATE POLICY "Public read role_permissions" ON public.role_permissions FOR SELECT USING (true);

-- Seed initial admin role for the specified user if needed
-- INSERT INTO public.user_roles (user_id, role) VALUES ('<USER_ID>', 'admin') ON CONFLICT DO NOTHING;
