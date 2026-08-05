import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/comissoes")({ component: Comissoes });

function weekStartOf(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

function Comissoes() {
  const qc = useQueryClient();
  const [week, setWeek] = useState(weekStartOf(new Date()));
  const weekEnd = useMemo(() => new Date(new Date(week).getTime() + 6 * 86400000).toISOString().slice(0, 10), [week]);

  const { data: rows = [] } = useQuery({
    queryKey: ["weekly-result", week],
    queryFn: async () =>
      (await supabase.from("v_weekly_vehicle_result" as any).select("*").eq("week_start", week)).data ?? [],
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ["veh-comm"], queryFn: async () => (await supabase.from("vehicles" as any).select("id,plate,brand,model,usage_type,owner_company,rental_weekly_cost")).data ?? [] });
  const { data: drivers = [] } = useQuery({ queryKey: ["drv-comm"], queryFn: async () => (await supabase.from("drivers" as any).select("id,full_name,commission_pct")).data ?? [] });
  const { data: settled = [] } = useQuery({
    queryKey: ["settlements", week],
    queryFn: async () => (await supabase.from("commission_settlements" as any).select("*").eq("week_start", week)).data ?? [],
  });

  const computed = rows.map((r: any) => {
    const v = (vehicles as any[]).find((x: any) => x.id === r.vehicle_id);
    const d = (drivers as any[]).find((x: any) => x.id === r.driver_id);
    const rental = v?.usage_type === "aluguel" ? Number(v?.rental_weekly_cost || 0) : 0;
    const pct = Number(d?.commission_pct || 0);
    const net = Number(r.net_profit || 0) - rental;
    const commission = (net > 0 ? net : 0) * (pct / 100);
    const existing = (settled as any[]).find((s: any) => s.vehicle_id === r.vehicle_id && s.driver_id === r.driver_id);
    return {
      ...r, vehicle: v, driver: d, rental, pct, net, commission,
      company: net - commission, paid: existing?.paid ?? false, existingId: existing?.id,
    };
  });

  const save = useMutation({
    mutationFn: async (row: any) => {
      const payload = {
        week_start: week, week_end: weekEnd, vehicle_id: row.vehicle_id, driver_id: row.driver_id,
        gross_income: Number(row.gross_income || 0), expenses: Number(row.expenses || 0),
        net_profit: row.net, commission_pct: row.pct, commission_amount: row.commission,
        rental_cost: row.rental, amount_due_driver: row.commission, amount_due_company: row.company,
        paid: true, paid_at: new Date().toISOString(),
      };
      const { error } = row.existingId
        ? await supabase.from("commission_settlements" as any).update(payload as any).eq("id", row.existingId)
        : await supabase.from("commission_settlements" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Comissão liquidada"); qc.invalidateQueries({ queryKey: ["settlements"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const totals = computed.reduce((a: any, r: any) => ({
    gross: a.gross + Number(r.gross_income || 0), exp: a.exp + Number(r.expenses || 0),
    rental: a.rental + r.rental, comm: a.comm + r.commission, comp: a.comp + r.company,
  }), { gross: 0, exp: 0, rental: 0, comm: 0, comp: 0 });

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title="Comissões Semanais"
        description="Resultado por veículo e motorista: receitas − despesas − aluguer, com comissão automática."
        actions={
          <div className="flex gap-2 items-center">
            <Input type="date" value={week} onChange={(e) => setWeek(weekStartOf(new Date(e.target.value)))} className="w-44" />
            <Badge variant="outline">{week} → {weekEnd}</Badge>
          </div>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Receitas</div><div className="text-lg font-bold text-emerald-600">€ {totals.gross.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Despesas</div><div className="text-lg font-bold text-destructive">€ {totals.exp.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Aluguer viaturas</div><div className="text-lg font-bold">€ {totals.rental.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Comissões motoristas</div><div className="text-lg font-bold text-gold">€ {totals.comm.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Resultado empresa</div><div className={`text-lg font-bold ${totals.comp < 0 ? "text-destructive" : "text-emerald-600"}`}>€ {totals.comp.toFixed(2)}</div></Card>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Veículo</TableHead><TableHead>Motorista</TableHead>
            <TableHead className="text-right">Receitas</TableHead><TableHead className="text-right">Despesas</TableHead>
            <TableHead className="text-right">Aluguer</TableHead><TableHead className="text-right">Resultado</TableHead>
            <TableHead className="text-right">% Com.</TableHead><TableHead className="text-right">A pagar motorista</TableHead>
            <TableHead className="text-right">Empresa</TableHead><TableHead className="text-right">Ação</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {computed.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="whitespace-nowrap">{r.vehicle?.plate ?? "—"}{r.vehicle?.owner_company ? <div className="text-xs text-muted-foreground">{r.vehicle.owner_company}</div> : null}</TableCell>
                <TableCell>{r.driver?.full_name ?? "—"}</TableCell>
                <TableCell className="text-right">€ {Number(r.gross_income || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">€ {Number(r.expenses || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">€ {r.rental.toFixed(2)}</TableCell>
                <TableCell className={`text-right font-medium ${r.net < 0 ? "text-destructive" : "text-emerald-600"}`}>€ {r.net.toFixed(2)}</TableCell>
                <TableCell className="text-right">{r.pct}%</TableCell>
                <TableCell className="text-right font-medium">€ {r.commission.toFixed(2)}</TableCell>
                <TableCell className="text-right">€ {r.company.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  {r.paid ? <Badge className="bg-emerald-600 text-white">Liquidado</Badge>
                    : <Button size="sm" variant="outline" onClick={() => save.mutate(r)}>Liquidar</Button>}
                </TableCell>
              </TableRow>
            ))}
            {computed.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Sem turnos nesta semana.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
