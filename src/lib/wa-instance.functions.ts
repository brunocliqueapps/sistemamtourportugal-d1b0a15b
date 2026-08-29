import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Integração WhatsApp via API não oficial baseada em instância
 * (Evolution API / Baileys — compatível com endpoints padrão da Evolution API v2).
 *
 * Segredos necessários no servidor:
 *  - EVOLUTION_API_URL        ex.: https://minha-evolution.com
 *  - EVOLUTION_API_KEY        apikey global da instalação
 *  - EVOLUTION_INSTANCE       nome da instância (ex.: mtour)
 *  - EVOLUTION_WEBHOOK_TOKEN  token simples para validar o webhook (opcional mas recomendado)
 */

type Cfg = { base: string; key: string; instance: string };

function readConfig(): Cfg | null {
  const base = process.env["EVOLUTION_API_URL"];
  const key = process.env["EVOLUTION_API_KEY"];
  const instance = process.env["EVOLUTION_INSTANCE"] ?? "mtour";
  if (!base || !key) return null;
  return { base: base.replace(/\/+$/, ""), key, instance };
}

async function evo(cfg: Cfg, path: string, init?: RequestInit) {
  const res = await fetch(`${cfg.base}${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

/** Estado da configuração + estado de ligação da instância. */
export const getInstanceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = readConfig();
    if (!cfg) {
      return {
        configured: false,
        instance: process.env["EVOLUTION_INSTANCE"] ?? null,
        state: null as string | null,
        exists: false,
        error: null as string | null,
      };
    }

    const state = await evo(cfg, `/instance/connectionState/${encodeURIComponent(cfg.instance)}`);
    const value =
      state.json?.instance?.state ?? state.json?.state ?? (state.ok ? "unknown" : null);

    return {
      configured: true,
      instance: cfg.instance,
      state: value as string | null,
      exists: state.status !== 404,
      error: state.ok ? null : (state.json?.message ?? state.json?.error ?? `Erro ${state.status}`),
    };
  });

/** Cria a instância (se necessário) e devolve o QR Code para emparelhar o telemóvel. */
export const connectInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = readConfig();
    if (!cfg) throw new Error("Configuração ausente: EVOLUTION_API_URL e EVOLUTION_API_KEY.");

    const origin = process.env["APP_ORIGIN"] ?? process.env["VITE_APP_ORIGIN"] ?? null;
    const webhookToken = process.env["EVOLUTION_WEBHOOK_TOKEN"] ?? null;
    const webhookUrl = origin
      ? `${origin.replace(/\/+$/, "")}/api/public/whatsapp/evolution${webhookToken ? `?token=${encodeURIComponent(webhookToken)}` : ""}`
      : null;

    const state = await evo(cfg, `/instance/connectionState/${encodeURIComponent(cfg.instance)}`);

    if (state.status === 404 || (!state.ok && state.status >= 400 && state.status < 500)) {
      const created = await evo(cfg, `/instance/create`, {
        method: "POST",
        body: JSON.stringify({
          instanceName: cfg.instance,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          ...(webhookUrl
            ? {
                webhook: {
                  url: webhookUrl,
                  byEvents: false,
                  base64: true,
                  events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
                },
              }
            : {}),
        }),
      });
      if (!created.ok && created.status !== 403) {
        throw new Error(created.json?.message ?? created.json?.error ?? `Erro ${created.status} ao criar instância.`);
      }
      const qr = created.json?.qrcode?.base64 ?? created.json?.base64 ?? null;
      if (qr) return { qr, pairingCode: created.json?.qrcode?.pairingCode ?? null, webhookUrl };
    }

    const conn = await evo(cfg, `/instance/connect/${encodeURIComponent(cfg.instance)}`);
    if (!conn.ok) {
      throw new Error(conn.json?.message ?? conn.json?.error ?? `Erro ${conn.status} ao ligar instância.`);
    }
    return {
      qr: (conn.json?.base64 ?? conn.json?.qrcode?.base64 ?? null) as string | null,
      pairingCode: (conn.json?.pairingCode ?? conn.json?.code ?? null) as string | null,
      webhookUrl,
    };
  });

/** Termina a sessão do WhatsApp na instância (mantém a instância criada). */
export const disconnectInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = readConfig();
    if (!cfg) throw new Error("Configuração ausente: EVOLUTION_API_URL e EVOLUTION_API_KEY.");
    const res = await evo(cfg, `/instance/logout/${encodeURIComponent(cfg.instance)}`, { method: "DELETE" });
    if (!res.ok) throw new Error(res.json?.message ?? `Erro ${res.status} ao desligar instância.`);
    return { ok: true };
  });
