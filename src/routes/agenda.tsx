import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/agenda")({ component: Agenda });

function Agenda() {
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const to = new Date(new Date(from).getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const { data } = useQuery({
    queryKey: ["agenda", from],
    queryFn: async () => {
      const { data } = await supabase.from("service_orders")
        .select("*, clients(name,phone), drivers(full_name), vehicles(plate)")
        .gte("service_date", from).lte("service_date", to)
        .order("service_date").order("start_time");
      return data ?? [];
    },
  });

  const grouped = (data ?? []).reduce<Record<string, any[]>>((acc, s: any) => {
    (acc[s.service_date] = acc[s.service_date] ?? []).push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Agenda" description="Serviços agendados na semana." actions={
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
      } />
      {Object.keys(grouped).length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">Sem serviços neste período.</Card>
      )}
      {Object.entries(grouped).map(([date, list]) => (
        <div key={date}>
          <h3 className="font-semibold mb-3">{new Date(date).toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" })}</h3>
          <div className="space-y-2">
            {list.map((s: any) => (
              <Card key={s.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{s.start_time?.slice(0, 5) ?? "—"}</span>
                      <Link to="/oc/$id" params={{ id: s.id }} className="text-primary hover:underline">{s.oc_code}</Link>
                      <Badge variant="outline">{s.voucher_code}</Badge>
                    </div>
                    <div className="text-sm mt-1">{s.clients?.name ?? "—"} {s.clients?.phone && `· ${s.clients.phone}`}</div>
                    <div className="text-xs text-muted-foreground">{s.origin} → {s.destination} · {s.passengers ?? 0} pax</div>
                    <div className="text-xs text-muted-foreground">{s.drivers?.full_name ?? "Sem motorista"} · {s.vehicles?.plate ?? "Sem veículo"}</div>
                  </div>
                  <div className="text-right">
                    <Badge>{s.status}</Badge>
                    <div className="font-semibold mt-2">€ {Number(s.sale_value || 0).toFixed(2)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
