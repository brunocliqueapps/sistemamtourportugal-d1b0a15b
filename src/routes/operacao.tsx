import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/operacao")({ component: Operacao });

function Operacao() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: today } = useQuery({
    queryKey: ["driver-day-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const d = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("driver_days").select("*").eq("driver_id", user!.id).eq("date", d).is("end_time", null).maybeSingle();
      return data;
    },
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-mini"],
    queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model")).data ?? [],
  });
  const { data: items = [] } = useQuery({
    queryKey: ["checklist-items"],
    queryFn: async () => (await supabase.from("checklist_items").select("*")).data ?? [],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["driver-days-history", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("driver_days").select("*, vehicles(plate)").eq("driver_id", user!.id).order("date", { ascending: false }).limit(10)).data ?? [],
  });

  const [form, setForm] = useState<any>({ vehicle_id: "", km_initial: 0, fuel_initial: 100, checks: {} as Record<string, boolean> });
  const [end, setEnd] = useState({ km_final: 0, fuel_final: 0 });

  useEffect(() => { if (today) setEnd({ km_final: today.km_initial ?? 0, fuel_final: today.fuel_initial ?? 0 }); }, [today]);

  const open = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("driver_days").insert({
        driver_id: user!.id, vehicle_id: form.vehicle_id, date: new Date().toISOString().slice(0, 10),
        start_time: new Date().toISOString(), km_initial: form.km_initial, fuel_initial: form.fuel_initial,
      }).select().single();
      if (error) throw error;
      const rows = items.filter((i: any) => form.checks[i.id]).map((i: any) => ({ driver_day_id: data.id, checklist_item_id: i.id, checked: true }));
      if (rows.length) await supabase.from("driver_day_checklist").insert(rows);
    },
    onSuccess: () => { toast.success("Dia aberto"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("driver_days").update({
        end_time: new Date().toISOString(), km_final: end.km_final, fuel_final: end.fuel_final,
      }).eq("id", today!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dia fechado"); qc.invalidateQueries(); },
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Operação do Motorista" description="Abertura e fechamento do dia com checklist." />

      {!today ? (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Abrir o dia</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Veículo</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Km inicial</Label><Input type="number" value={form.km_initial} onChange={(e) => setForm({ ...form, km_initial: Number(e.target.value) })} /></div>
            <div><Label>Combustível (%)</Label><Input type="number" min={0} max={100} value={form.fuel_initial} onChange={(e) => setForm({ ...form, fuel_initial: Number(e.target.value) })} /></div>
          </div>
          <div>
            <Label className="mb-2 block">Checklist</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {items.map((i: any) => (
                <label key={i.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!form.checks[i.id]} onCheckedChange={(v) => setForm({ ...form, checks: { ...form.checks, [i.id]: !!v } })} />
                  {i.name}
                </label>
              ))}
            </div>
          </div>
          <Button className="gradient-gold text-gold-foreground" onClick={() => open.mutate()} disabled={!form.vehicle_id}>Abrir Dia</Button>
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Dia em curso · abriu às {new Date(today.start_time).toLocaleTimeString("pt-PT")}</h3>
            <span className="text-sm text-muted-foreground">Km inicial: {today.km_initial}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Km final</Label><Input type="number" value={end.km_final} onChange={(e) => setEnd({ ...end, km_final: Number(e.target.value) })} /></div>
            <div><Label>Combustível final (%)</Label><Input type="number" value={end.fuel_final} onChange={(e) => setEnd({ ...end, fuel_final: Number(e.target.value) })} /></div>
          </div>
          <Button variant="destructive" onClick={() => close.mutate()}>Fechar Dia</Button>
        </Card>
      )}

      <Card>
        <div className="p-6 pb-0"><h3 className="font-semibold">Histórico</h3></div>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Km</TableHead><TableHead>Combustível</TableHead></TableRow></TableHeader>
          <TableBody>
            {history.map((h: any) => (
              <TableRow key={h.id}>
                <TableCell>{h.date}</TableCell>
                <TableCell>{h.vehicles?.plate ?? "—"}</TableCell>
                <TableCell>{h.km_initial ?? 0} → {h.km_final ?? "—"}</TableCell>
                <TableCell>{h.fuel_initial ?? 0}% → {h.fuel_final ?? "—"}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
