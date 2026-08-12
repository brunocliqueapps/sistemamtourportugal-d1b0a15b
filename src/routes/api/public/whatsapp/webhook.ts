import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

function digitsOnly(v: string) {
  return String(v).replace(/[^\d]/g, "");
}

function verifySignature(rawBody: string, header: string | null, appSecret?: string): boolean {
  // Sem app secret configurado não bloqueamos (a Meta valida via verify token no setup).
  if (!appSecret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(header.slice("sha256=".length));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      // Verificação do webhook pela Meta
      GET: async ({ request }) => {
        const verifyToken = process.env["WHATSAPP_VERIFY_TOKEN"];
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && verifyToken && token === verifyToken) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      // Receção de mensagens e estados de entrega
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), process.env["WHATSAPP_APP_SECRET"])) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb: any = supabaseAdmin;

        for (const entry of payload?.entry ?? []) {
          for (const change of entry?.changes ?? []) {
            const value = change?.value ?? {};

            // Atualiza estados de mensagens enviadas
            for (const st of value?.statuses ?? []) {
              if (!st?.id) continue;
              await sb
                .from("whatsapp_messages")
                .update({ status: st.status ?? "sent", error_message: st?.errors?.[0]?.title ?? null })
                .eq("wa_message_id", st.id);
            }

            const contacts: any[] = value?.contacts ?? [];
            for (const msg of value?.messages ?? []) {
              const from = digitsOnly(msg?.from ?? "");
              if (!from) continue;
              const contactName =
                contacts.find((c) => digitsOnly(c?.wa_id ?? "") === from)?.profile?.name ?? null;

              // Conversa (upsert por número)
              let convId: string | null = null;
              const { data: conv } = await sb
                .from("whatsapp_conversations")
                .select("id, client_id, contact_name")
                .eq("wa_phone", from)
                .maybeSingle();

              // Tenta ligar ao cliente pelos últimos 9 dígitos do telefone
              let clientId: string | null = conv?.client_id ?? null;
              if (!clientId) {
                const tail = from.slice(-9);
                const { data: clients } = await sb
                  .from("clients")
                  .select("id, phone")
                  .not("phone", "is", null)
                  .ilike("phone", `%${tail}%`)
                  .limit(1);
                clientId = clients?.[0]?.id ?? null;
              }

              const text: string =
                msg?.text?.body ??
                msg?.button?.text ??
                msg?.interactive?.list_reply?.title ??
                msg?.interactive?.button_reply?.title ??
                (msg?.type ? `[${msg.type}]` : "");
              const msgAt = msg?.timestamp
                ? new Date(Number(msg.timestamp) * 1000).toISOString()
                : new Date().toISOString();

              if (conv?.id) {
                convId = conv.id;
                await sb
                  .from("whatsapp_conversations")
                  .update({
                    contact_name: contactName ?? conv.contact_name ?? null,
                    client_id: clientId,
                    last_message: text,
                    last_message_at: msgAt,
                    archived: false,
                  })
                  .eq("id", convId);
              } else {
                const { data: created } = await sb
                  .from("whatsapp_conversations")
                  .insert({
                    wa_phone: from,
                    contact_name: contactName,
                    client_id: clientId,
                    last_message: text,
                    last_message_at: msgAt,
                    unread_count: 0,
                  })
                  .select("id")
                  .single();
                convId = created?.id ?? null;
              }
              if (!convId) continue;

              // Incrementa não lidas
              const { data: cur } = await sb
                .from("whatsapp_conversations")
                .select("unread_count")
                .eq("id", convId)
                .maybeSingle();
              await sb
                .from("whatsapp_conversations")
                .update({ unread_count: (cur?.unread_count ?? 0) + 1 })
                .eq("id", convId);

              await sb.from("whatsapp_messages").upsert(
                {
                  conversation_id: convId,
                  direction: "in",
                  msg_type: msg?.type ?? "text",
                  body: text,
                  media_url: null,
                  wa_message_id: msg?.id ?? null,
                  status: "received",
                  message_at: msgAt,
                },
                { onConflict: "wa_message_id", ignoreDuplicates: true },
              );
            }
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
