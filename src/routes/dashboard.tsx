import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Users, TrendingUp, Euro, Car } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold mt-1">{value}</div>
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
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [leadsR, propR, payR, vehR] = await Promise.all([
        supabase.from("leads").select("id,origin,status,created_at"),
        supabase.from("proposals").select("id,total_value,status,created_at"),
        supabase.from("payments").select("amount,payment_date"),
        supabase.from("vehicles").select("id"),
      ]);
      return {
        leads: leadsR.data ?? [],
        proposals: propR.data ?? [],
        payments: payR.data ?? [],
        vehicles: vehR.data ?? [],
      };
    },
  });

  const leads = data?.leads ?? [];
  const proposals = data?.proposals ?? [];
  const payments = data?.payments ?? [];
  const totalRevenue = payments.reduce((a, p) => a + Number(p.amount || 0), 0);
  const closed = proposals.filter((p) => p.status === "aceita" || p.status === "concluida").length;
  const conversion = leads.length ? Math.round((closed / leads.length) * 100) : 0;

  const originData = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const k = l.origin || "Sem origem";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const revenueByMonth = Object.entries(
    payments.reduce<Record<string, number>>((acc, p) => {
      const k = (p.payment_date || "").slice(0, 7);
      acc[k] = (acc[k] || 0) + Number(p.amount || 0);
      return acc;
    }, {})
  )
    .sort()
    .map(([mes, valor]) => ({ mes, valor }));

  const colors = ["oklch(0.24 0.07 260)", "oklch(0.78 0.13 82)", "oklch(0.55 0.12 260)", "oklch(0.68 0.15 45)"];

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Dashboard" description="Indicadores comerciais, financeiros e de frota." />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={Users} label="Leads recebidos" value={String(leads.length)} />
        <Kpi icon={TrendingUp} label="Vendas fechadas" value={String(closed)} hint={`Conversão ${conversion}%`} />
        <Kpi icon={Euro} label="Faturamento" value={`€ ${totalRevenue.toFixed(2)}`} />
        <Kpi icon={Car} label="Veículos" value={String(data?.vehicles.length ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Vendas por origem</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={originData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {originData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Faturamento por mês (€)</h3>
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
    </div>
  );
}
