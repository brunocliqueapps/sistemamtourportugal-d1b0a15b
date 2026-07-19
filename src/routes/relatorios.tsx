import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";

export const Route = createFileRoute("/relatorios")({ component: Relatorios });

const colors = [
  "oklch(0.24 0.07 260)", "oklch(0.78 0.13 82)", "oklch(0.55 0.12 260)",
  "oklch(0.68 0.15 45)", "oklch(0.5 0.15 20)", "oklch(0.6 0.15 160)",
  "oklch(0.65 0.15 300)", "oklch(0.7 0.12 120)",
];

type Period = "day" | "week" | "month" | "year" | "custom";
type Group = "day" | "week" | "month" | "vehicle" | "driver" | "operation_type";

function startOf(period: Period): string {
  const d = new Date();
  if (period === "day") return d.toISOString().slice(0, 10);
  if (period === "week") { d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); }
  if (period === "month") { d.setDate(1); return d.toISOString().slice(0, 10); }
  if (period === "year") { d.setMonth(0, 1); return d.toISOString().slice(0, 10); }
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function weekKey(iso: string): string {
  const d = new Date(iso);
  const first = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - first.getTime()) / 86400000 + first.getDay() + 1) / 7);
  return `${d.getFullYear()}-S${String(week).padStart(2, "0")}`;
}
function groupKey(date: string, g: Group, extra?: string): string {
  if (!date) return "—";
  if (g === "day") return date.slice(0, 10);
  if (g === "week") return weekKey(date);
  if (g === "month") return date.slice(0, 7);
  return extra || "—";
}

function KPI({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function Relatorios() {
  const [period, setPeriod] = useState<Period>("year");
  const [from, setFrom] = useState(startOf("year"));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [driverId, setDriverId] = useState<string>("all");
  const [vehicleId, setVehicleId] = useState<string>("all");
  const [clientId, setClientId] = useState<string>("all");
  const [group, setGroup] = useState<Group>("month");
  const [report, setReport] = useState<string>("faturamento");

  const applyPeriod = (p: Period) => {
    setPeriod(p);
    if (p !== "custom") {
      setFrom(startOf(p));
      setTo(new Date().toISOString().slice(0, 10));
    }
  };

  const { data: filters } = useQuery({
    queryKey: ["rep-filters"],
    queryFn: async () => {
      const [dR, vR, cR] = await Promise.all([
        supabase.from("drivers").select("id,full_name").order("full_name"),
        supabase.from("vehicles").select("id,plate").order("plate"),
        supabase.from("clients").select("id,name").order("name"),
      ]);
      return { drivers: dR.data ?? [], vehicles: vR.data ?? [], clients: cR.data ?? [] };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["rep-data", from, to, driverId, vehicleId, clientId],
    queryFn: async () => {
      let soQ = supabase.from("service_orders")
        .select("id,oc_code,client_id,driver_id,vehicle_id,service_date,status,operation_type,sale_value,drivers(full_name),vehicles(plate),clients(name)")
        .gte("service_date", from).lte("service_date", to);
      if (driverId !== "all") soQ = soQ.eq("driver_id", driverId);
      if (vehicleId !== "all") soQ = soQ.eq("vehicle_id", vehicleId);
      if (clientId !== "all") soQ = soQ.eq("client_id", clientId);

      const [leadsR, invR, soR, cmR, partR] = await Promise.all([
        supabase.from("leads").select("id,name,origin,status,created_at").gte("created_at", from).lte("created_at", to + "T23:59:59"),
        supabase.from("invoices").select("id,kind,total,issue_date,entity_name,status").gte("issue_date", from).lte("issue_date", to),
        soQ,
        supabase.from("cash_movements").select("kind,amount,created_at,description").gte("created_at", from).lte("created_at", to + "T23:59:59"),
        supabase.from("partners").select("id,name").limit(500),
      ]);
      return {
        leads: leadsR.data ?? [], inv: invR.data ?? [], so: soR.data ?? [],
        cash: cmR.data ?? [], partners: partR.data ?? [],
      };
    },
  });

  const leads = data?.leads ?? [];
  const inv = data?.inv ?? [];
  const so = data?.so ?? [];
  const cash = data?.cash ?? [];

  const receitas = inv.filter((i: any) => i.kind === "entrada");
  const despesas = inv.filter((i: any) => i.kind === "saida");
  const totRec = receitas.reduce((a: number, i: any) => a + Number(i.total || 0), 0);
  const totDesp = despesas.reduce((a: number, i: any) => a + Number(i.total || 0), 0);
  const inflow = cash.filter((c: any) => c.kind === "entrada").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
  const outflow = cash.filter((c: any) => c.kind === "saida").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
  const convRate = leads.length ? Math.round(leads.filter((l: any) => l.status === "fechado").length / leads.length * 100) : 0;

  // Grouping helper for SO-based reports
  const groupSO = (valueOf: (s: any) => number) => {
    const acc: Record<string, number> = {};
    for (const s of so) {
      const key = group === "vehicle" ? (s.vehicles?.plate || "—")
        : group === "driver" ? (s.drivers?.full_name || "—")
        : group === "operation_type" ? (s.operation_type || "—")
        : groupKey(s.service_date, group);
      acc[key] = (acc[key] || 0) + valueOf(s);
    }
    return Object.entries(acc).map(([name, valor]) => ({ name, valor })).sort((a, b) => a.name.localeCompare(b.name));
  };

  const groupInv = (list: any[]) => {
    const acc: Record<string, number> = {};
    for (const i of list) {
      const key = groupKey(i.issue_date, group === "vehicle" || group === "driver" || group === "operation_type" ? "month" : group);
      acc[key] = (acc[key] || 0) + Number(i.total || 0);
    }
    return Object.entries(acc).map(([name, valor]) => ({ name, valor })).sort((a, b) => a.name.localeCompare(b.name));
  };

  const origemLeads = Object.entries(leads.reduce<Record<string, number>>((a, l: any) => {
    const k = l.origin || "Sem origem"; a[k] = (a[k] || 0) + 1; return a;
  }, {})).map(([name, value]) => ({ name, value }));

  const funil = ["novo", "em_negociacao", "proposta_enviada", "fechado", "perdido"].map((s) => ({
    name: s.replace("_", " "),
    value: leads.filter((l: any) => l.status === s).length,
  }));

  const clientesRank = Object.entries(so.reduce<Record<string, number>>((a, s: any) => {
    const k = s.clients?.name || "—"; a[k] = (a[k] || 0) + Number(s.sale_value || 0); return a;
  }, {})).map(([name, valor]) => ({ name, valor })).sort((a, b) => b.valor - a.valor).slice(0, 15);

  const motoristas = groupSO((s) => Number(s.sale_value || 0));
  const veiculos = groupSO((s) => Number(s.sale_value || 0));

  const opTipo = Object.entries(so.reduce<Record<string, number>>((a, s: any) => {
    const k = s.operation_type || "—"; a[k] = (a[k] || 0) + 1; return a;
  }, {})).map(([name, value]) => ({ name, value }));

  const fluxo = (() => {
    const rec: Record<string, number> = {};
    const des: Record<string, number> = {};
    for (const c of cash) {
      const k = groupKey((c.created_at || "").slice(0, 10), group === "vehicle" || group === "driver" || group === "operation_type" ? "month" : group);
      if (c.kind === "entrada") rec[k] = (rec[k] || 0) + Number(c.amount || 0);
      else des[k] = (des[k] || 0) + Number(c.amount || 0);
    }
    const keys = Array.from(new Set([...Object.keys(rec), ...Object.keys(des)])).sort();
    return keys.map((k) => ({ name: k, entrada: rec[k] || 0, saida: des[k] || 0, saldo: (rec[k] || 0) - (des[k] || 0) }));
  })();

  const receitasSerie = groupInv(receitas);
  const despesasSerie = groupInv(despesas);

  const servicosPorStatus = Object.entries(so.reduce<Record<string, number>>((a, s: any) => {
    const k = s.status || "—"; a[k] = (a[k] || 0) + 1; return a;
  }, {})).map(([name, value]) => ({ name, value }));

  const parceirosCount = data?.partners?.length ?? 0;
  const clientesAtivos = new Set(so.map((s: any) => s.client_id).filter(Boolean)).size;

  const exportCsv = (rows: any[], filename: string) => {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const reports: Record<string, { title: string; render: () => JSX.Element }> = {
    leads: {
      title: "Leads",
      render: () => (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Origem dos leads</h3>
            <div className="h-72">
              <ResponsiveContainer><PieChart>
                <Pie data={origemLeads} dataKey="value" nameKey="name" outerRadius={90} label>
                  {origemLeads.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie><Legend />
              </PieChart></ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Funil</h3>
            <div className="h-72">
              <ResponsiveContainer><BarChart data={funil}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis /><Tooltip />
                <Bar dataKey="value" fill={colors[1]} radius={[6, 6, 0, 0]} />
              </BarChart></ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Lista de leads</h3>
              <Button variant="outline" size="sm" onClick={() => exportCsv(leads, "leads.csv")}>Exportar CSV</Button>
            </div>
            <Table><TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Origem</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead>
            </TableRow></TableHeader><TableBody>
              {leads.slice(0, 100).map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>{l.name}</TableCell><TableCell>{l.origin || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                  <TableCell>{(l.created_at || "").slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </Card>
        </div>
      ),
    },
    conversao: {
      title: "Conversão de vendas",
      render: () => (
        <div className="grid gap-4 md:grid-cols-3">
          <KPI label="Leads" value={leads.length} />
          <KPI label="Fechados" value={leads.filter((l: any) => l.status === "fechado").length} />
          <KPI label="Conversão" value={`${convRate}%`} tone="text-emerald-600" />
          <Card className="p-5 md:col-span-3">
            <h3 className="font-semibold mb-4">Funil de conversão</h3>
            <div className="h-72">
              <ResponsiveContainer><BarChart data={funil} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={140} /><Tooltip />
                <Bar dataKey="value" fill={colors[0]} />
              </BarChart></ResponsiveContainer>
            </div>
          </Card>
        </div>
      ),
    },
    servicos: {
      title: "Serviços e Operação",
      render: () => (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5"><h3 className="font-semibold mb-4">Serviços por estado</h3>
            <div className="h-72">
              <ResponsiveContainer><PieChart>
                <Pie data={servicosPorStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                  {servicosPorStatus.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie><Legend /></PieChart></ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5"><h3 className="font-semibold mb-4">Tipo de operação</h3>
            <div className="h-72">
              <ResponsiveContainer><PieChart>
                <Pie data={opTipo} dataKey="value" nameKey="name" outerRadius={90} label>
                  {opTipo.map((_, i) => <Cell key={i} fill={colors[(i + 2) % colors.length]} />)}
                </Pie><Legend /></PieChart></ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Ordens de serviço</h3>
              <Button variant="outline" size="sm" onClick={() => exportCsv(so.map((s: any) => ({
                oc: s.oc_code, data: s.service_date, cliente: s.clients?.name, motorista: s.drivers?.full_name,
                veiculo: s.vehicles?.plate, tipo: s.operation_type, status: s.status, valor: s.sale_value,
              })), "servicos.csv")}>Exportar CSV</Button>
            </div>
            <Table><TableHeader><TableRow>
              <TableHead>OC</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead>
              <TableHead>Motorista</TableHead><TableHead>Veículo</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead>
            </TableRow></TableHeader><TableBody>
              {so.slice(0, 100).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.oc_code}</TableCell>
                  <TableCell>{s.service_date}</TableCell>
                  <TableCell>{s.clients?.name || "—"}</TableCell>
                  <TableCell>{s.drivers?.full_name || "—"}</TableCell>
                  <TableCell>{s.vehicles?.plate || "—"}</TableCell>
                  <TableCell>{s.operation_type || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                  <TableCell className="text-right">€ {Number(s.sale_value || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </Card>
        </div>
      ),
    },
    faturamento: {
      title: "Faturamento",
      render: () => (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5 md:col-span-2">
            <h3 className="font-semibold mb-4">Receitas vs Despesas</h3>
            <div className="h-72">
              <ResponsiveContainer><BarChart data={receitasSerie.map((r) => ({
                name: r.name, receita: r.valor, despesa: despesasSerie.find((d) => d.name === r.name)?.valor ?? 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="receita" fill={colors[1]} /><Bar dataKey="despesa" fill={colors[4]} />
              </BarChart></ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Faturas</h3>
              <Button variant="outline" size="sm" onClick={() => exportCsv(inv, "faturas.csv")}>Exportar CSV</Button>
            </div>
            <Table><TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Entidade</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader><TableBody>
              {inv.slice(0, 100).map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i.issue_date}</TableCell>
                  <TableCell><Badge variant={i.kind === "entrada" ? "default" : "secondary"}>{i.kind}</Badge></TableCell>
                  <TableCell>{i.entity_name || "—"}</TableCell>
                  <TableCell>{i.status}</TableCell>
                  <TableCell className="text-right">€ {Number(i.total || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </Card>
        </div>
      ),
    },
    receitas: {
      title: "Receitas",
      render: () => (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Receitas</h3>
          <div className="h-72">
            <ResponsiveContainer><AreaChart data={receitasSerie}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis /><Tooltip />
              <Area type="monotone" dataKey="valor" stroke={colors[1]} fill={colors[1]} fillOpacity={0.3} />
            </AreaChart></ResponsiveContainer>
          </div>
        </Card>
      ),
    },
    despesas: {
      title: "Despesas",
      render: () => (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Despesas</h3>
          <div className="h-72">
            <ResponsiveContainer><AreaChart data={despesasSerie}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis /><Tooltip />
              <Area type="monotone" dataKey="valor" stroke={colors[4]} fill={colors[4]} fillOpacity={0.3} />
            </AreaChart></ResponsiveContainer>
          </div>
        </Card>
      ),
    },
    fluxo: {
      title: "Fluxo de caixa",
      render: () => (
        <div className="grid gap-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Entradas · Saídas · Saldo</h3>
            <div className="h-72">
              <ResponsiveContainer><LineChart data={fluxo}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
                <Line type="monotone" dataKey="entrada" stroke={colors[1]} />
                <Line type="monotone" dataKey="saida" stroke={colors[4]} />
                <Line type="monotone" dataKey="saldo" stroke={colors[0]} strokeWidth={2} />
              </LineChart></ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Movimentos</h3>
              <Button variant="outline" size="sm" onClick={() => exportCsv(fluxo, "fluxo-caixa.csv")}>Exportar CSV</Button>
            </div>
            <Table><TableHeader><TableRow>
              <TableHead>Período</TableHead><TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Saldo</TableHead>
            </TableRow></TableHeader><TableBody>
              {fluxo.map((f) => (
                <TableRow key={f.name}>
                  <TableCell>{f.name}</TableCell>
                  <TableCell className="text-right text-emerald-600">€ {f.entrada.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-destructive">€ {f.saida.toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-semibold ${f.saldo < 0 ? "text-destructive" : ""}`}>€ {f.saldo.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </Card>
        </div>
      ),
    },
    motoristas: {
      title: "Motoristas",
      render: () => (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Faturação por motorista</h3>
          <div className="h-80">
            <ResponsiveContainer><BarChart data={motoristas} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={140} /><Tooltip />
              <Bar dataKey="valor" fill={colors[0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </Card>
      ),
    },
    veiculos: {
      title: "Veículos",
      render: () => (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Faturação por veículo</h3>
          <div className="h-80">
            <ResponsiveContainer><BarChart data={veiculos} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={140} /><Tooltip />
              <Bar dataKey="valor" fill={colors[2]} />
            </BarChart></ResponsiveContainer>
          </div>
        </Card>
      ),
    },
    parceiros: {
      title: "Parceiros",
      render: () => (
        <div className="grid gap-4 md:grid-cols-2">
          <KPI label="Parceiros ativos" value={parceirosCount} />
          <KPI label="Receita parceiros (faturas)" value={`€ ${totRec.toFixed(2)}`} hint="Filtra por entidade nas faturas" />
        </div>
      ),
    },
    clientes: {
      title: "Clientes",
      render: () => (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <KPI label="Clientes ativos no período" value={clientesAtivos} />
            <KPI label="Ticket médio" value={`€ ${(clientesAtivos ? totRec / clientesAtivos : 0).toFixed(2)}`} />
            <KPI label="Serviços totais" value={so.length} />
          </div>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Top clientes por faturação</h3>
              <Button variant="outline" size="sm" onClick={() => exportCsv(clientesRank, "clientes.csv")}>Exportar CSV</Button>
            </div>
            <div className="h-80">
              <ResponsiveContainer><BarChart data={clientesRank} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={160} /><Tooltip />
                <Bar dataKey="valor" fill={colors[5]} />
              </BarChart></ResponsiveContainer>
            </div>
          </Card>
        </div>
      ),
    },
    origem: {
      title: "Origem das vendas",
      render: () => (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Origem dos leads convertidos</h3>
            <div className="h-72">
              <ResponsiveContainer><PieChart>
                <Pie data={origemLeads} dataKey="value" nameKey="name" outerRadius={90} label>
                  {origemLeads.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie><Legend /></PieChart></ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Distribuição</h3>
            <Table><TableHeader><TableRow>
              <TableHead>Origem</TableHead><TableHead className="text-right">Leads</TableHead>
            </TableRow></TableHeader><TableBody>
              {origemLeads.map((o) => (
                <TableRow key={o.name}><TableCell>{o.name}</TableCell><TableCell className="text-right">{o.value}</TableCell></TableRow>
              ))}
            </TableBody></Table>
          </Card>
        </div>
      ),
    },
  };

  const resultData = useMemo(() => {
    const acc: Record<string, { servicos: number; receita: number }> = {};
    for (const s of so) {
      const key = group === "vehicle" ? (s.vehicles?.plate || "—")
        : group === "driver" ? (s.drivers?.full_name || "—")
        : group === "operation_type" ? (s.operation_type || "—")
        : groupKey(s.service_date, group);
      if (!acc[key]) acc[key] = { servicos: 0, receita: 0 };
      acc[key].servicos += 1;
      acc[key].receita += Number(s.sale_value || 0);
    }
    return Object.entries(acc).map(([name, v]) => ({ name, ...v })).sort((a, b) => a.name.localeCompare(b.name));
  }, [so, group]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Relatórios e Resultados" description="Análise detalhada com filtros e agrupamentos." />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div>
            <Label className="text-xs">Período</Label>
            <Select value={period} onValueChange={(v) => applyPeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Dia</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPeriod("custom"); }} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPeriod("custom"); }} /></div>
          <div>
            <Label className="text-xs">Motorista</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {filters?.drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Veículo</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {filters?.vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {filters?.clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        <KPI label="Receitas" value={`€ ${totRec.toFixed(2)}`} tone="text-emerald-600" />
        <KPI label="Despesas" value={`€ ${totDesp.toFixed(2)}`} tone="text-destructive" />
        <KPI label="Saldo caixa" value={`€ ${(inflow - outflow).toFixed(2)}`} tone={inflow - outflow < 0 ? "text-destructive" : "text-emerald-600"} />
        <KPI label="Serviços" value={so.length} />
        <KPI label="Leads · Conv." value={`${leads.length} · ${convRate}%`} />
      </div>

      <Tabs defaultValue="relatorios">
        <TabsList>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="relatorios" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(reports).map(([k, r]) => (
              <Button key={k} size="sm" variant={report === k ? "default" : "outline"} onClick={() => setReport(k)}>
                {r.title}
              </Button>
            ))}
          </div>
          {isLoading ? <Card className="p-8 text-center text-muted-foreground">A carregar…</Card> : reports[report].render()}
        </TabsContent>

        <TabsContent value="resultados" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Label className="text-xs">Analisar por</Label>
              <Select value={group} onValueChange={(v) => setGroup(v as Group)}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                  <SelectItem value="vehicle">Veículo</SelectItem>
                  <SelectItem value="driver">Motorista</SelectItem>
                  <SelectItem value="operation_type">Tipo de operação</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => exportCsv(resultData, `resultados-${group}.csv`)}>Exportar CSV</Button>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Receita por {group}</h3>
              <div className="h-72">
                <ResponsiveContainer><BarChart data={resultData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis /><Tooltip />
                  <Bar dataKey="receita" fill={colors[1]} radius={[6, 6, 0, 0]} />
                </BarChart></ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Serviços por {group}</h3>
              <div className="h-72">
                <ResponsiveContainer><LineChart data={resultData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis /><Tooltip />
                  <Line type="monotone" dataKey="servicos" stroke={colors[0]} strokeWidth={2} />
                </LineChart></ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5 md:col-span-2">
              <h3 className="font-semibold mb-4">Tabela de resultados</h3>
              <Table><TableHeader><TableRow>
                <TableHead>{group}</TableHead><TableHead className="text-right">Serviços</TableHead>
                <TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Média/serviço</TableHead>
              </TableRow></TableHeader><TableBody>
                {resultData.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.servicos}</TableCell>
                    <TableCell className="text-right">€ {r.receita.toFixed(2)}</TableCell>
                    <TableCell className="text-right">€ {(r.servicos ? r.receita / r.servicos : 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
