import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_clients",
  title: "Pesquisar clientes",
  description: "Search CRM clients by name, client number, email or phone; returns up to 20 matches.",
  inputSchema: {
    query: z.string().max(100).optional().describe("Text to search. Omit to list the most recent clients."),
    status: z.string().max(50).optional().describe("Optional pipeline status filter, e.g. novo, fechado."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, status }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("clients")
      .select("id,client_number,name,email,phone,status,origin,passengers,arrival_date,departure_date,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (query) {
      const s = query.replace(/[,%()]/g, " ").trim();
      q = q.or(`name.ilike.%${s}%,client_number.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
    }
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const clients = (data ?? []).map((c) => ({
      id: c.id,
      client_number: c.client_number,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
      origin: c.origin,
      passengers: c.passengers,
      arrival_date: c.arrival_date,
      departure_date: c.departure_date,
    }));
    const text = clients.length
      ? clients.map((c) => `${c.client_number ?? "—"} ${c.name} (${c.status ?? "sem estado"}) id=${c.id}`).join("\n")
      : "Nenhum cliente encontrado.";
    return { content: [{ type: "text", text }], structuredContent: { clients } };
  },
});
