-- =====================================================================
-- MTOUR PORTUGAL — Migração V3
-- Cole no SQL Editor do Supabase e execute.
-- Adiciona: RBAC granular, configurações do admin, pós-venda com pesquisa.
-- =====================================================================

-- 1) Papéis adicionais (comercial, administrativo, motorista)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='comercial' AND enumtypid='app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'comercial';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='administrativo' AND enumtypid='app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'administrativo';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='motorista' AND enumtypid='app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'motorista';
  END IF;
END $$;

-- 2) Configurações da empresa (usado no PDF fiscal)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Mtour Portugal',
  nif text,
  address text,
  postal_code text,
  city text,
  country text DEFAULT 'Portugal',
  phone text,
  email text,
  website text,
  iban text,
  logo_url text,
  invoice_footer text,
  singleton boolean UNIQUE DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company read" ON public.company_settings;
CREATE POLICY "company read" ON public.company_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "company write admin" ON public.company_settings;
CREATE POLICY "company write admin" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.company_settings (name, singleton) VALUES ('Mtour Portugal', true)
  ON CONFLICT (singleton) DO NOTHING;

-- 3) Permissões por papel (matriz role × módulo)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module text NOT NULL,
  UNIQUE (role, module)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perm read" ON public.role_permissions;
CREATE POLICY "perm read" ON public.role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "perm write admin" ON public.role_permissions;
CREATE POLICY "perm write admin" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Defaults
INSERT INTO public.role_permissions (role, module) VALUES
  ('admin','dashboard'),('admin','crm'),('admin','propostas'),('admin','oc'),('admin','operacao'),
  ('admin','tvde'),('admin','financeiro'),('admin','conta_corrente'),('admin','fechamento'),
  ('admin','relatorios'),('admin','cadastros'),('admin','pos_venda'),('admin','importar'),
  ('admin','configuracoes'),('admin','agenda'),
  ('comercial','dashboard'),('comercial','crm'),('comercial','propostas'),('comercial','pos_venda'),('comercial','agenda'),
  ('administrativo','dashboard'),('administrativo','financeiro'),('administrativo','conta_corrente'),
  ('administrativo','fechamento'),('administrativo','relatorios'),('administrativo','cadastros'),('administrativo','agenda'),
  ('motorista','dashboard'),('motorista','operacao'),('motorista','tvde'),('motorista','agenda')
ON CONFLICT (role, module) DO NOTHING;

-- Função helper: verifica permissão do utilizador para um módulo
CREATE OR REPLACE FUNCTION public.has_module(_user uuid, _module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user AND rp.module = _module
  );
$$;

-- 4) Pós-venda: templates de pesquisa, envios e respostas
CREATE TABLE IF NOT EXISTS public.survey_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{id,label,type:'rating'|'yes_no'|'text',required}]
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_templates TO authenticated;
GRANT ALL ON public.survey_templates TO service_role;
ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "st read" ON public.survey_templates;
CREATE POLICY "st read" ON public.survey_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "st write admin" ON public.survey_templates;
CREATE POLICY "st write admin" ON public.survey_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  template_id uuid REFERENCES public.survey_templates(id) ON DELETE SET NULL,
  service_order_id uuid REFERENCES public.service_orders(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_email text,
  client_name text,
  status text DEFAULT 'pendente', -- pendente | enviado | respondido
  sent_at timestamptz,
  answered_at timestamptz,
  nps_score int,
  average_score numeric(4,2),
  answers jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT SELECT, UPDATE ON public.surveys TO anon; -- cliente responde via link público (token)
GRANT ALL ON public.surveys TO service_role;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "srv read auth" ON public.surveys;
CREATE POLICY "srv read auth" ON public.surveys FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "srv write auth" ON public.surveys;
CREATE POLICY "srv write auth" ON public.surveys FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Público só lê/atualiza a linha pelo token (aplicação usa .eq('token', ...))
DROP POLICY IF EXISTS "srv public read token" ON public.surveys;
CREATE POLICY "srv public read token" ON public.surveys FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "srv public answer" ON public.surveys;
CREATE POLICY "srv public answer" ON public.surveys FOR UPDATE TO anon USING (status <> 'respondido') WITH CHECK (true);

-- Template default
INSERT INTO public.survey_templates (name, description, questions) VALUES
  ('Pesquisa Pós-Serviço Padrão','Avaliação geral do serviço prestado.',
   '[
     {"id":"q1","label":"Como avalia o serviço prestado?","type":"rating","required":true},
     {"id":"q2","label":"Como avalia o motorista?","type":"rating","required":true},
     {"id":"q3","label":"Como avalia o veículo?","type":"rating","required":true},
     {"id":"q4","label":"Recomendaria os nossos serviços? (0-10)","type":"nps","required":true},
     {"id":"q5","label":"Comentários adicionais","type":"text","required":false}
   ]'::jsonb)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- FIM V3
-- =====================================================================
