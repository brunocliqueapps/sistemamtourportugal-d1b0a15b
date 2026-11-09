import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export default defineTool({
  name: "list_service_orders",
  title: "Listar ordens de serviço",
  description: "List service orders (OS) in a date range, optionally for one client; returns up to 50.",
  inputSchema: {
    from: isoDate.optional().describe("Start service date (YYYY-MM-DD). Defaults to today."),
    to: isoDate.optional().describe("End service date (YYYY-MM-DD). Defaults to 30 days after start."),
    client_id: z.string().uuid().optional().describe("Optional client id from search_clients."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, client_id }, ctx) => {
    const start = from ?? new Date().toISOString().slice(0, 10);
    const end = to ?? new Date(new Date(start).getTime() + 30 * 864e5).toISOString().slice(0, 10);
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("service_orders")
      .select("id,service_code,oc_code,service_date,start_time,status,origin,destination,passengers,sale_value,client_id,clients(name)")
      .gte("service_date", start)
      .lte("service_date", end)
      .order("service_date")
      .limit(50);
    if (client_id) q = q.eq("client_id", client_id);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const orders = (data ?? []).map((o) => {
      const cl = o.clients as { name?: string } | { name?: string }[] | null;
      const clientName = Array.isArray(cl) ? cl[0]?.name ?? null : cl?.name ?? null;
      return {
        id: o.id,
        code: o.service_code ?? o.oc_code,
        service_date: o.service_date,
        start_time: o.start_time,
        status: o.status,
        origin: o.origin,
        destination: o.destination,
        passengers: o.passengers,
        sale_value: o.sale_value,
        client_name: clientName,
      };
    });
    const text = orders.length
      ? orders.map((o) => `${o.service_date} ${o.code ?? ""} ${o.client_name ?? "—"}: ${o.origin ?? "?"} → ${o.destination ?? "?"} (${o.status ?? ""})`).join("\n")
      : "Sem ordens de serviço neste período.";
    return { content: [{ type: "text", text }], structuredContent: { orders } };
  },
});
