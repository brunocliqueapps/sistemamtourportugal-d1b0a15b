import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sendSchema = z.object({
  conversationId: z.string().uuid().optional(),
  phone: z.string().min(6).max(30),
  body: z.string().min(1).max(4000),
});

/** Estado da configuração da integração (sem expor segredos). */
export const getWhatsappStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      hasToken: !!process.env["WHATSAPP_ACCESS_TOKEN"],
      hasPhoneNumberId: !!process.env["WHATSAPP_PHONE_NUMBER_ID"],
      hasVerifyToken: !!process.env["WHATSAPP_VERIFY_TOKEN"],
      phoneNumberId: process.env["WHATSAPP_PHONE_NUMBER_ID"]
        ? `••••${String(process.env["WHATSAPP_PHONE_NUMBER_ID"]).slice(-4)}`
        : null,
    };
  });

/** Envia mensagem de texto via WhatsApp Cloud API e grava no histórico. */
export const sendWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const evoBase = process.env["EVOLUTION_API_URL"];
    const evoKey = process.env["EVOLUTION_API_KEY"];
    const evoInstance = process.env["EVOLUTION_INSTANCE"] ?? "mtour";
    const token = process.env["WHATSAPP_ACCESS_TOKEN"];
    const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
    const useEvolution = !!(evoBase && evoKey);
    if (!useEvolution && (!token || !phoneNumberId)) {
      throw new Error(
        "Integração WhatsApp não configurada. Configure a instância (EVOLUTION_API_URL/EVOLUTION_API_KEY) ou a Cloud API.",
      );
    }


    const to = data.phone.replace(/[^\d]/g, "");
    const sb: any = context.supabase;

    // Garante conversa
    let conversationId = data.conversationId ?? null;
    if (!conversationId) {
      const { data: existing } = await sb
        .from("whatsapp_conversations")
        .select("id")
        .eq("wa_phone", to)
        .maybeSingle();
      if (existing?.id) {
        conversationId = existing.id as string;
      } else {
        const { data: created, error } = await sb
          .from("whatsapp_conversations")
          .insert({ wa_phone: to })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        conversationId = created.id as string;
      }
    }

    let waMessageId: string | null = null;
    let status = "sent";
    let errorMessage: string | null = null;

    try {
      if (useEvolution) {
        const res = await fetch(
          `${evoBase!.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(evoInstance)}`,
          {
            method: "POST",
            headers: { apikey: evoKey!, "Content-Type": "application/json" },
            body: JSON.stringify({ number: to, text: data.body }),
          },
        );
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          status = "failed";
          errorMessage = json?.message ?? json?.error ?? `Erro ${res.status} ao enviar mensagem.`;
        } else {
          waMessageId = json?.key?.id ?? json?.id ?? null;
        }
        throw { __done: true };
      }
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: true, body: data.body },
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        status = "failed";
        errorMessage = json?.error?.message ?? `Erro ${res.status} ao enviar mensagem.`;
      } else {
        waMessageId = json?.messages?.[0]?.id ?? null;
      }
    } catch (e: any) {
      if (!e?.__done) {
        status = "failed";
        errorMessage = e?.message ?? "Falha de rede ao contactar o WhatsApp.";
      }
    }

    const nowIso = new Date().toISOString();
    await sb.from("whatsapp_messages").insert({
      conversation_id: conversationId,
      direction: "out",
      msg_type: "text",
      body: data.body,
      wa_message_id: waMessageId,
      status,
      error_message: errorMessage,
      sent_by: context.userId,
      message_at: nowIso,
    });

    await sb
      .from("whatsapp_conversations")
      .update({ last_message: data.body, last_message_at: nowIso })
      .eq("id", conversationId);

    if (status === "failed") {
      throw new Error(errorMessage ?? "Não foi possível enviar a mensagem.");
    }

    return { conversationId, waMessageId };
  });
