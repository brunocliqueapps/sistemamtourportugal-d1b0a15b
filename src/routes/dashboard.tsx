import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Euro, ClipboardList, AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

function Kpi({ icon: Icon, label, value, hint, tone }: any) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className={`text-3xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className="h-10 w-10 rounded-lg gradient-gold flex items-center justify-center text-gold-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = useQuery({
    queryKey: ["dashboard-v2"],
    queryFn: async () => {
      const [leadsR, soR, invR, cmR, alertsR] = await Promise.all([
        supabase.from("leads").select("id,status,origin,created_at"),
        supabase.from("service_orders").select("id,oc_code,client_id,service_date,start_time,origin,destination,status,sale_value").order("service_date"),
        supabase.from("invoices").select("kind,total,status,issue_date"),
        supabase.from("cash_movements").select("kind,amount"),
        supabase.from("document_alerts").select("*"),
      ]);
      return {
        leads: leadsR.data ?? [],
        services: soR.data ?? [],
        invoices: invR.data ?? [],
        cash: cmR.data ?? [],
        alerts: alertsR.data ?? [],
      };
    },
  });

  const leads = data?.leads ?? [];
  const services = data?.services ?? [];
  const inv = data?.invoices ?? [];
  const cash = data?.cash ?? [];
  const alerts = data?.alerts ?? [];

  const inflow = cash.filter((c: any) => c.kind === "entrada").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
  const outflow = cash.filter((c: any) => c.kind === "saida").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
  const balance = inflow - outflow;
  const revenue = inv.filter((i: any) => i.kind === "entrada").reduce((a: number, i: any) => a + Number(i.total || 0), 0);
  const todayServices = services.filter((s: any) => s.service_date === today);
  const inProgress = services.filter((s: any) => ["em_execucao", "cliente_a_bordo", "em_deslocacao"].includes(s.status));
  const soonAlerts = alerts.filter((a: any) => {
    if (!a.expiry) return false;
    const d = new Date(a.expiry).getTime();
    const diff = (d - Date.now()) / 86400000;
    return diff < 45;
  });

  const revenueByMonth = Object.entries(
    inv.filter((i: any) => i.kind === "entrada").reduce<Record<string, number>>((acc: Record<string, number>, i: any) => {
      const k = (i.issue_date || "").slice(0, 7);
      if (k) acc[k] = (acc[k] || 0) + Number(i.total || 0);
      return acc;
    }, {})
  ).sort().map(([mes, valor]) => ({ mes, valor }));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Dashboard" description="Visão geral operacional e financeira." />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={ClipboardList} label="Serviços hoje" value={todayServices.length} hint={`${inProgress.length} em curso`} />
        <Kpi icon={Users} label="Leads abertos" value={leads.filter((l: any) => l.status === "novo" || l.status === "em_negociacao").length} />
        <Kpi icon={Euro} label="Faturamento" value={`€ ${revenue.toFixed(2)}`} />
        <Kpi icon={Wallet} label="Saldo caixa" value={`€ ${balance.toFixed(2)}`} tone={balance < 0 ? "text-destructive" : "text-emerald-600"} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Entradas</div>
          <div className="text-2xl font-bold text-emerald-600">€ {inflow.toFixed(2)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Saídas</div>
          <div className="text-2xl font-bold text-destructive">€ {outflow.toFixed(2)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Conversão CRM</div>
          <div className="text-2xl font-bold">
            {leads.length ? Math.round((leads.filter((l: any) => l.status === "fechado").length / leads.length) * 100) : 0}%
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Agenda de hoje</h3>
            <Link to="/agenda" className="text-sm text-primary underline">Ver agenda</Link>
          </div>
          {todayServices.length === 0 && <div className="text-sm text-muted-foreground">Nenhum serviço agendado hoje.</div>}
          <div className="space-y-2">
            {todayServices.slice(0, 6).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <div>
                  <div className="font-medium">{s.oc_code} · {s.start_time?.slice(0, 5) ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{s.origin} → {s.destination}</div>
                </div>
                <Badge variant="outline">{s.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold">Alertas de documentos</h3>
          </div>
          {soonAlerts.length === 0 && <div className="text-sm text-muted-foreground">Sem vencimentos próximos.</div>}
          <div className="space-y-2">
            {soonAlerts.slice(0, 8).map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.doc}</div>
                </div>
                <Badge variant="destructive">{a.expiry}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4"><TrendingUp className="h-4 w-4" /><h3 className="font-semibold">Faturamento por mês</h3></div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="valor" fill="oklch(0.78 0.13 82)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
