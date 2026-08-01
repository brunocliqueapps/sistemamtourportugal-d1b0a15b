import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";

export const Route = createFileRoute("/agenda")({ component: Agenda });

const STATUS_LABEL: Record<string, string> = {
  para_atendimento: "Para Atendimento",
  em_atendimento: "Em Atendimento",
  atendimento_finalizado: "Atendimento Finalizado",
};
const STATUS_CLASS: Record<string, string> = {
  para_atendimento: "bg-slate-500",
  em_atendimento: "bg-amber-500",
  atendimento_finalizado: "bg-emerald-600",
};

function paymentBadge(sale: number, received: number) {
  if (sale <= 0) return { label: "—", cls: "bg-muted text-foreground" };
  if (received <= 0) return { label: "Por pagar", cls: "bg-rose-500 text-white" };
  if (received < sale) return { label: "Parcial", cls: "bg-amber-500 text-white" };
  return { label: "Pago", cls: "bg-emerald-600 text-white" };
}

function Agenda() {
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [range, setRange] = useState<"month" | "week" | "day">("month");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [year, setYear] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const days = range === "day" ? 0 : range === "week" ? 6 : 30;
  const to = new Date(new Date(from).getTime() + days * 86400000).toISOString().slice(0, 10);

  const lastDay = (y: string, m: string) => new Date(Number(y), Number(m), 0).getDate();
  const periodFrom = year === "all" ? from : month === "all" ? `${year}-01-01` : `${year}-${month}-01`;
  const periodTo = year === "all" ? to : month === "all" ? `${year}-12-31` : `${year}-${month}-${String(lastDay(year, month)).padStart(2, "0")}`;

  const { data: vehicles = [] } = useQuery({ queryKey: ["agenda-vehicles"], queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model,owner_company").order("plate")).data ?? [] });
  const { data: driversList = [] } = useQuery({ queryKey: ["agenda-drivers"], queryFn: async () => (await supabase.from("drivers").select("id,full_name").order("full_name")).data ?? [] });

  const { data } = useQuery({
    queryKey: ["agenda", periodFrom, periodTo, statusFilter, vehicleFilter, driverFilter],
    queryFn: async () => {
      let q = supabase.from("service_orders")
        .select("*, clients(name,phone,nif), drivers(full_name), vehicles(plate,brand,model,owner_company), proposals(code,title,itinerary_start,itinerary_end)")
        .gte("service_date", periodFrom)
        .lte("service_date", periodTo)
        .order("service_date").order("start_time");
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (vehicleFilter !== "all") q = q.eq("vehicle_id", vehicleFilter);
      if (driverFilter !== "all") q = q.eq("driver_id", driverFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Agrupado por viagem (proposta) e não por Ordem de Serviço
  const trips = Object.values((data ?? []).reduce<Record<string, { key: string; label: string; period: string; client: string; list: any[] }>>((acc, s: any) => {
    const key = s.proposal_id ?? `os-${s.id}`;
    if (!acc[key]) {
      const start = s.proposals?.itinerary_start ?? s.service_date;
      const end = s.proposals?.itinerary_end ?? s.service_date;
      acc[key] = {
        key,
        label: s.proposals?.code ? `Viagem ${s.proposals.code}${s.proposals.title ? ` · ${s.proposals.title}` : ""}` : `Serviço avulso ${s.oc_code ?? ""}`,
        period: start === end ? String(start) : `${start} → ${end}`,
        client: s.clients?.name ?? "—",
        list: [],
      };
    }
    acc[key].list.push(s);
    return acc;
  }, {})).sort((a, b) => (a.period > b.period ? 1 : -1));

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title="Agenda"
        description="Serviços agendados com informações rápidas por cliente."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" disabled={year !== "all"} />
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Por período</SelectItem>
                {Array.from({ length: 6 }, (_, i) => String(2026 + i)).map((y) => <SelectItem key={y} value={y}>Ano {y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={month} onValueChange={setMonth} disabled={year === "all"}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                  <SelectItem key={m} value={m}>
                    {new Date(2026, Number(m) - 1, 1).toLocaleDateString("pt-PT", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={(v) => setRange(v as any)} disabled={year !== "all"}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="day">Dia</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os veículos</SelectItem>
                {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand ?? ""} {v.model ?? ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os motoristas</SelectItem>
                {driversList.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {Object.keys(grouped).length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">Sem serviços neste período.</Card>
      )}

      {Object.entries(grouped).map(([date, list]) => (
        <div key={date}>
          <h3 className="font-semibold mb-3">
            {new Date(date).toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" })}
          </h3>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Horário</TableHead>
                  <TableHead>OC / Voucher</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Origem → Destino</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead className="text-center">Pax</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s: any) => {
                  const pay = paymentBadge(Number(s.sale_value || 0), Number(s.amount_received || 0));
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.start_time?.slice(0, 5) ?? "—"}</TableCell>
                      <TableCell>
                        <Link to="/oc/$id" params={{ id: s.id }} className="text-primary hover:underline font-medium">
                          {s.oc_code}
                        </Link>
                        <div className="text-xs text-muted-foreground">{s.voucher_code}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{s.operation_type ?? "—"}</Badge></TableCell>
                      <TableCell>{s.clients?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.clients?.phone ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.origin ?? "—"} → {s.destination ?? "—"}</TableCell>
                      <TableCell>{s.drivers?.full_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{s.vehicles ? `${s.vehicles.brand ?? ""} ${s.vehicles.model ?? ""}`.trim() || "—" : "—"}</TableCell>
                      <TableCell className="font-mono">{s.vehicles?.plate ?? "—"}</TableCell>
                      <TableCell className="text-center">{s.passengers ?? 0}</TableCell>
                      <TableCell className="text-right font-semibold">€ {Number(s.sale_value || 0).toFixed(2)}</TableCell>
                      <TableCell><span className={`text-xs px-2 py-0.5 rounded ${pay.cls}`}>{pay.label}</span></TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded text-white ${STATUS_CLASS[s.status] ?? "bg-slate-500"}`}>
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      ))}
    </div>
  );
}
