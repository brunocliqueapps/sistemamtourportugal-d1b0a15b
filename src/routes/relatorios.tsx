import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/relatorios")({ component: Relatorios });

const colors = ["oklch(0.24 0.07 260)", "oklch(0.78 0.13 82)", "oklch(0.55 0.12 260)", "oklch(0.68 0.15 45)", "oklch(0.5 0.15 20)"];

function Relatorios() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data } = useQuery({
    queryKey: ["rep", from, to],
    queryFn: async () => {
      const [leadsR, invR, soR] = await Promise.all([
        supabase.from("leads").select("origin,status,created_at").gte("created_at", from).lte("created_at", to + "T23:59:59"),
        supabase.from("invoices").select("kind,total,issue_date").gte("issue_date", from).lte("issue_date", to),
        supabase.from("service_orders").select("sale_value,status,service_date,driver_id,vehicle_id,drivers(full_name),vehicles(plate)").gte("service_date", from).lte("service_date", to),
      ]);
      return { leads: leadsR.data ?? [], inv: invR.data ?? [], so: soR.data ?? [] };
    },
  });

  const leads = data?.leads ?? [];
  const inv = data?.inv ?? [];
  const so = data?.so ?? [];

  const origem = Object.entries(leads.reduce<Record<string, number>>((a, l: any) => { const k = l.origin || "Sem origem"; a[k] = (a[k] || 0) + 1; return a; }, {})).map(([name, value]) => ({ name, value }));
  const conv = leads.length ? Math.round(leads.filter((l: any) => l.status === "fechado").length / leads.length * 100) : 0;

  const revMes = Object.entries(inv.filter((i: any) => i.kind === "entrada").reduce<Record<string, number>>((a, i: any) => { const k = (i.issue_date || "").slice(0, 7); a[k] = (a[k] || 0) + Number(i.total || 0); return a; }, {})).sort().map(([mes, valor]) => ({ mes, valor }));
  const despMes = Object.entries(inv.filter((i: any) => i.kind === "saida").reduce<Record<string, number>>((a, i: any) => { const k = (i.issue_date || "").slice(0, 7); a[k] = (a[k] || 0) + Number(i.total || 0); return a; }, {})).sort().map(([mes, valor]) => ({ mes, valor }));

  const porMotorista = Object.entries(so.reduce<Record<string, number>>((a, s: any) => { const k = s.drivers?.full_name || "—"; a[k] = (a[k] || 0) + Number(s.sale_value || 0); return a; }, {})).map(([name, valor]) => ({ name, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  const porVeiculo = Object.entries(so.reduce<Record<string, number>>((a, s: any) => { const k = s.vehicles?.plate || "—"; a[k] = (a[k] || 0) + Number(s.sale_value || 0); return a; }, {})).map(([name, valor]) => ({ name, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Relatórios" description="Filtra por período." actions={
        <div className="flex gap-2">
          <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        </div>
      } />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Leads</div><div className="text-2xl font-bold">{leads.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Conversão</div><div className="text-2xl font-bold">{conv}%</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Serviços</div><div className="text-2xl font-bold">{so.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Receita total</div><div className="text-2xl font-bold">€ {inv.filter((i: any) => i.kind==="entrada").reduce((a: number, i: any) => a + Number(i.total||0), 0).toFixed(2)}</div></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Origem dos leads</h3>
          <div className="h-64">
            <ResponsiveContainer><PieChart>
              <Pie data={origem} dataKey="value" nameKey="name" outerRadius={90} label>{origem.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie>
              <Legend />
            </PieChart></ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Receitas vs Despesas (mensal)</h3>
          <div className="h-64">
            <ResponsiveContainer><BarChart data={revMes.map((r) => ({ mes: r.mes, receita: r.valor, despesa: despMes.find((d) => d.mes === r.mes)?.valor ?? 0 }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="mes" /><YAxis /><Tooltip />
              <Bar dataKey="receita" fill={colors[1]} /><Bar dataKey="despesa" fill={colors[4]} />
            </BarChart></ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Faturação por Motorista</h3>
          <div className="h-64">
            <ResponsiveContainer><BarChart data={porMotorista} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={100} /><Tooltip />
              <Bar dataKey="valor" fill={colors[0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Faturação por Veículo</h3>
          <div className="h-64">
            <ResponsiveContainer><BarChart data={porVeiculo} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={100} /><Tooltip />
              <Bar dataKey="valor" fill={colors[2]} />
            </BarChart></ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
