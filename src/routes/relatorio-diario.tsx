import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format-date";
import { Download } from "lucide-react";

export const Route = createFileRoute("/relatorio-diario")({
  component: RelatorioDiario,
  head: () => ({
    meta: [
      { title: "Relatório Diário · MTOUR Portugal" },
      { name: "description", content: "Clientes registados, orçamentos criados e serviços fechados por dia, com exportação em PDF." },
      { property: "og:title", content: "Relatório Diário · MTOUR Portugal" },
      { property: "og:description", content: "Resumo diário de clientes, orçamentos e serviços fechados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const dayOf = (v?: string | null) => (v ? String(v).slice(0, 10) : "");

function RelatorioDiario() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(today());

  const { data, isFetching } = useQuery({
    queryKey: ["relatorio-diario", from, to],
    queryFn: async () => {
      const endTs = `${to}T23:59:59.999Z`;
      const [clients, proposals, orders] = await Promise.all([
        supabase.from("clients").select("id,created_at,name,client_number,phone,email").gte("created_at", from).lte("created_at", endTs),
        supabase.from("proposals").select("id,created_at,code,title,total_value,status,clients(name)").gte("created_at", from).lte("created_at", endTs),
        supabase.from("service_orders").select("id,status,service_date,sale_value,oc_code,origin,destination,clients(name)").gte("service_date", from).lte("service_date", to),
      ]);
      return {
        clients: clients.data ?? [],
        proposals: proposals.data ?? [],
        orders: (orders.data ?? []).filter((o: any) => ["finalizado", "atendimento_finalizado"].includes(String(o.status))),
      };
    },
  });

  const rows = useMemo(() => {
    if (!from || !to || from > to) return [];
    const out: { day: string; clients: number; proposals: number; closed: number; value: number }[] = [];
    for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      const closed = (data?.orders ?? []).filter((o: any) => dayOf(o.service_date) === day);
      out.push({
        day,
        clients: (data?.clients ?? []).filter((c: any) => dayOf(c.created_at) === day).length,
        proposals: (data?.proposals ?? []).filter((p: any) => dayOf(p.created_at) === day).length,
        closed: closed.length,
        value: closed.reduce((s: number, o: any) => s + Number(o.sale_value || 0), 0),
      });
    }
    return out;
  }, [data, from, to]);

  const totals = rows.reduce(
    (a, r) => ({ clients: a.clients + r.clients, proposals: a.proposals + r.proposals, closed: a.closed + r.closed, value: a.value + r.value }),
    { clients: 0, proposals: 0, closed: 0, value: 0 },
  );

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório Diário · MTOUR Portugal", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${fmtDate(from)} a ${fmtDate(to)}`, 14, 25);
    autoTable(doc, {
      startY: 32,
      head: [["Data", "Clientes registados", "Orçamentos feitos", "Serviços fechados", "Valor (€)"]],
      body: rows.map((r) => [fmtDate(r.day), String(r.clients), String(r.proposals), String(r.closed), r.value.toFixed(2)]),
      foot: [["Total", String(totals.clients), String(totals.proposals), String(totals.closed), totals.value.toFixed(2)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 42, 78] },
      footStyles: { fillColor: [200, 164, 92], textColor: 20 },
    });
    doc.save(`relatorio-diario-${from}_${to}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title="Relatório Diário"
        description="Clientes registados, orçamentos feitos e serviços fechados por dia."
        actions={
          <Button onClick={exportPdf} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Descarregar PDF
          </Button>
        }
      />

      <Card className="p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="grid gap-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-44" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-44" />
        </div>
        <Button variant="outline" onClick={() => { setFrom(daysAgo(6)); setTo(today()); }}>Últimos 7 dias</Button>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Clientes registados", value: totals.clients },
          { label: "Orçamentos feitos", value: totals.proposals },
          { label: "Serviços fechados", value: totals.closed },
          { label: "Valor fechado", value: `€ ${totals.value.toFixed(2)}` },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-bold mt-1">{k.value}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-center">Clientes registados</TableHead>
              <TableHead className="text-center">Orçamentos feitos</TableHead>
              <TableHead className="text-center">Serviços fechados</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{isFetching ? "A carregar…" : "Selecione um período válido."}</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.day}>
                <TableCell className="whitespace-nowrap">{fmtDate(r.day)}</TableCell>
                <TableCell className="text-center">{r.clients}</TableCell>
                <TableCell className="text-center">{r.proposals}</TableCell>
                <TableCell className="text-center">{r.closed}</TableCell>
                <TableCell className="text-right font-semibold">€ {r.value.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <DetailList
          title="Clientes registados"
          empty="Sem clientes no período."
          items={(data?.clients ?? []).map((c: any) => ({
            id: c.id,
            day: dayOf(c.created_at),
            primary: [c.client_number, c.name].filter(Boolean).join(" · "),
            secondary: [c.phone, c.email].filter(Boolean).join(" · "),
          }))}
        />
        <DetailList
          title="Orçamentos feitos"
          empty="Sem orçamentos no período."
          items={(data?.proposals ?? []).map((p: any) => ({
            id: p.id,
            day: dayOf(p.created_at),
            primary: [p.code, p.clients?.name || p.title].filter(Boolean).join(" · "),
            secondary: [p.status, p.total_value ? `€ ${Number(p.total_value).toFixed(2)}` : null].filter(Boolean).join(" · "),
          }))}
        />
        <DetailList
          title="Serviços fechados"
          empty="Sem serviços fechados no período."
          items={(data?.orders ?? []).map((o: any) => ({
            id: o.id,
            day: dayOf(o.service_date),
            primary: [o.oc_code, o.clients?.name].filter(Boolean).join(" · "),
            secondary: [[o.origin, o.destination].filter(Boolean).join(" → "), o.sale_value ? `€ ${Number(o.sale_value).toFixed(2)}` : null].filter(Boolean).join(" · "),
          }))}
        />
      </div>
    </div>
  );
}

type DetailItem = { id: string; day: string; primary: string; secondary?: string };

function DetailList({ title, items, empty }: { title: string; items: DetailItem[]; empty: string }) {
  const sorted = [...items].sort((a, b) => (a.day < b.day ? 1 : -1));
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">{sorted.length}</span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{empty}</p>
      ) : (
        <ul className="divide-y max-h-80 overflow-y-auto">
          {sorted.map((it) => (
            <li key={it.id} className="py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium break-words">{it.primary || "—"}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(it.day)}</span>
              </div>
              {it.secondary ? <div className="text-xs text-muted-foreground break-words">{it.secondary}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
