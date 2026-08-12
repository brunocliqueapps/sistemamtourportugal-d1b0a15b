CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone text NOT NULL UNIQUE,
  contact_name text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  last_message text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'in',
  msg_type text NOT NULL DEFAULT 'text',
  body text,
  media_url text,
  wa_message_id text UNIQUE,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  sent_by uuid,
  message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_msgs_conv ON public.whatsapp_messages(conversation_id, message_at);
CREATE INDEX IF NOT EXISTS idx_wa_conv_last ON public.whatsapp_conversations(last_message_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_conv_auth_all" ON public.whatsapp_conversations;
CREATE POLICY "wa_conv_auth_all" ON public.whatsapp_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wa_msgs_auth_all" ON public.whatsapp_messages;
CREATE POLICY "wa_msgs_auth_all" ON public.whatsapp_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS tg_wa_conv_upd ON public.whatsapp_conversations;
CREATE TRIGGER tg_wa_conv_upd BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.role_permissions (role, module)
SELECT r, 'mensagens' FROM (VALUES ('admin'::app_role), ('comercial'::app_role), ('administrativo'::app_role)) v(r)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp WHERE rp.role = v.r AND rp.module = 'mensagens'
);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;