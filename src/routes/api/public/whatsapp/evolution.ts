import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook da API não oficial (Evolution API / Baileys).
 * Configurar na instância: POST {origin}/api/public/whatsapp/evolution?token=EVOLUTION_WEBHOOK_TOKEN
 * Eventos: MESSAGES_UPSERT, MESSAGES_UPDATE, CONNECTION_UPDATE
 */

function digitsOnly(v: string) {
  return String(v).replace(/[^\d]/g, "");
}

function phoneFromJid(jid: string) {
  return digitsOnly(String(jid).split("@")[0] ?? "");
}

function extractText(message: any): string {
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    message?.buttonsResponseMessage?.selectedDisplayText ??
    message?.listResponseMessage?.title ??
    (message?.audioMessage ? "[áudio]" : null) ??
    (message?.imageMessage ? "[imagem]" : null) ??
    (message?.documentMessage ? "[documento]" : null) ??
    (message?.locationMessage ? "[localização]" : null) ??
    ""
  );
}

export const Route = createFileRoute("/api/public/whatsapp/evolution")({
  server: {
    handlers: {
      GET: async () => new Response("ok", { status: 200 }),

      POST: async ({ request }) => {
        const expected = process.env["EVOLUTION_WEBHOOK_TOKEN"];
        if (expected) {
          const url = new URL(request.url);
          const provided =
            url.searchParams.get("token") ??
            request.headers.get("x-webhook-token") ??
            request.headers.get("apikey");
          if (provided !== expected) return new Response("Unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const event = String(payload?.event ?? "").toLowerCase().replace(/_/g, ".");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb: any = supabaseAdmin;

        // Atualizações de estado das mensagens enviadas
        if (event === "messages.update") {
          const items = Array.isArray(payload?.data) ? payload.data : [payload?.data];
          for (const it of items) {
            const id = it?.keyId ?? it?.key?.id;
            if (!id) continue;
            const st = String(it?.status ?? "").toLowerCase();
            const mapped =
              st.includes("read") ? "read" : st.includes("delivery") || st.includes("delivered") ? "delivered" : st || "sent";
            await sb.from("whatsapp_messages").update({ status: mapped }).eq("wa_message_id", id);
          }
          return new Response("ok");
        }

        if (event !== "messages.upsert") return new Response("ok");

        const items = Array.isArray(payload?.data) ? payload.data : [payload?.data];
        for (const item of items) {
          const key = item?.key ?? {};
          const remoteJid = String(key?.remoteJid ?? "");
          if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid.includes("status@")) continue;

          const phone = phoneFromJid(remoteJid);
          if (!phone) continue;

          const fromMe = !!key?.fromMe;
          const text = extractText(item?.message) || (item?.messageType ? `[${item.messageType}]` : "");
          const msgAt = item?.messageTimestamp
            ? new Date(Number(item.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString();
          const contactName = item?.pushName ?? null;

          const { data: conv } = await sb
            .from("whatsapp_conversations")
            .select("id, client_id, contact_name, unread_count")
            .eq("wa_phone", phone)
            .maybeSingle();

          let clientId: string | null = conv?.client_id ?? null;
          if (!clientId) {
            const tail = phone.slice(-9);
            const { data: clients } = await sb
              .from("clients")
              .select("id")
              .not("phone", "is", null)
              .ilike("phone", `%${tail}%`)
              .limit(1);
            clientId = clients?.[0]?.id ?? null;
          }

          let convId: string | null = conv?.id ?? null;
          if (convId) {
            await sb
              .from("whatsapp_conversations")
              .update({
                contact_name: contactName ?? conv?.contact_name ?? null,
                client_id: clientId,
                last_message: text,
                last_message_at: msgAt,
                archived: false,
                unread_count: fromMe ? (conv?.unread_count ?? 0) : (conv?.unread_count ?? 0) + 1,
              })
              .eq("id", convId);
          } else {
            const { data: created } = await sb
              .from("whatsapp_conversations")
              .insert({
                wa_phone: phone,
                contact_name: contactName,
                client_id: clientId,
                last_message: text,
                last_message_at: msgAt,
                unread_count: fromMe ? 0 : 1,
              })
              .select("id")
              .single();
            convId = created?.id ?? null;
          }
          if (!convId) continue;

          await sb.from("whatsapp_messages").upsert(
            {
              conversation_id: convId,
              direction: fromMe ? "out" : "in",
              msg_type: item?.messageType ?? "text",
              body: text,
              wa_message_id: key?.id ?? null,
              status: fromMe ? "sent" : "received",
              message_at: msgAt,
            },
            { onConflict: "wa_message_id", ignoreDuplicates: true },
          );
        }

        return new Response("ok");
      },
    },
  },
});
