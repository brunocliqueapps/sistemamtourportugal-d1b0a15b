import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/frota/manutencao")({ component: Manutencao });

function Manutencao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [m, setM] = useState({ vehicle_id: "", type: "preventiva", km: 0, date: new Date().toISOString().slice(0, 10), notes: "" });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-mini2"],
    queryFn: async () => (await supabase.from("vehicles").select("id,plate")).data ?? [],
  });
  const { data: mts = [] } = useQuery({
    queryKey: ["maintenances"],
    queryFn: async () => (await supabase.from("maintenances").select("*, vehicles(plate)").order("date", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("maintenances").insert({ ...m, user_id: user?.id }); if (error) throw error; },
    onSuccess: () => { toast.success("Manutenção agendada"); qc.invalidateQueries({ queryKey: ["maintenances"] }); setM({ ...m, notes: "", km: 0 }); },
  });

  const alerts = mts.filter((x: any) => {
    const days = (Date.now() - new Date(x.date).getTime()) / 86400000;
    return days > 180;
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Manutenção" description="Preventivas e alertas automáticos." />

      {alerts.length > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>{alerts.length} alerta(s):</strong> manutenções realizadas há mais de 6 meses.
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Agendar</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={m.vehicle_id} onValueChange={(v) => setM({ ...m, vehicle_id: v })}>
            <SelectTrigger><SelectValue placeholder="Veículo" /></SelectTrigger>
            <SelectContent>{vehicles.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.plate}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={m.type} onValueChange={(v) => setM({ ...m, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="preventiva">Preventiva</SelectItem>
              <SelectItem value="corretiva">Corretiva</SelectItem>
              <SelectItem value="revisao">Revisão</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Km" value={m.km} onChange={(e) => setM({ ...m, km: Number(e.target.value) })} />
          <Input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
        </div>
        <div className="mt-3"><Label>Notas</Label><Textarea value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} /></div>
        <Button className="mt-4 gradient-gold text-gold-foreground" onClick={() => add.mutate()} disabled={!m.vehicle_id}>Agendar Manutenção</Button>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Tipo</TableHead><TableHead>Km</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader>
          <TableBody>
            {mts.map((x: any) => (
              <TableRow key={x.id}><TableCell>{x.date}</TableCell><TableCell>{x.vehicles?.plate}</TableCell><TableCell>{x.type}</TableCell><TableCell>{x.km}</TableCell><TableCell className="text-sm text-muted-foreground">{x.notes}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
