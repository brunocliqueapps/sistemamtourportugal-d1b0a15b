import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/operacao")({ component: Operacao });

function Operacao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ vehicle_id: "", operation_type: "privado", km_initial: 0 });

  const { data: shift } = useQuery({
    queryKey: ["shift-open", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("tvde_shifts").select("*").is("closed_at", null).order("created_at",{ascending:false}).limit(1).maybeSingle()).data,
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ["veh-op"], queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model").eq("active", true)).data ?? [] });
  const { data: myOCs = [] } = useQuery({
    queryKey: ["my-ocs", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("service_orders").select("id,oc_code,service_date,start_time,origin,destination,status,clients(name)").order("service_date", { ascending: false }).limit(20)).data ?? [],
  });

  const open = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tvde_shifts").insert({
        vehicle_id: form.vehicle_id, operation_type: form.operation_type,
        shift_date: new Date().toISOString().slice(0, 10),
        start_time: new Date().toISOString(), km_initial: Number(form.km_initial) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Turno aberto"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Turnos Motorista" description="Abre o turno indicando o tipo de operação (Privado, TVDE, Interno)." />

      {!shift ? (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Abrir turno</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label>Tipo de operação</Label>
              <Select value={form.operation_type} onValueChange={(v) => setForm({ ...form, operation_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="privado">Serviço privado</SelectItem>
                  <SelectItem value="tvde">Plataforma TVDE</SelectItem>
                  <SelectItem value="interno">Uso interno</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Veículo</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Km inicial</Label><Input type="number" value={form.km_initial} onChange={(e) => setForm({ ...form, km_initial: e.target.value })} /></div>
          </div>
          <Button className="gradient-gold text-gold-foreground" onClick={() => open.mutate()} disabled={!form.vehicle_id}>Abrir turno</Button>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Turno em curso</div>
              <div className="font-semibold">Tipo: <Badge>{shift.operation_type}</Badge> · Iniciado {new Date(shift.start_time).toLocaleTimeString("pt-PT")}</div>
            </div>
            {shift.operation_type === "tvde"
              ? <Link to="/tvde" className="text-primary underline">Ir para fechamento TVDE →</Link>
              : <span className="text-sm text-muted-foreground">Fecha os serviços privados nas respetivas OCs</span>}
          </div>
        </Card>
      )}

      <Card>
        <div className="p-5 pb-0"><h3 className="font-semibold">Meus últimos serviços</h3></div>
        <Table>
          <TableHeader><TableRow><TableHead>OC</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Trajeto</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
          <TableBody>
            {myOCs.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell><Link to="/oc/$id" params={{ id: s.id }} className="text-primary hover:underline font-mono text-xs">{s.oc_code}</Link></TableCell>
                <TableCell>{s.service_date} {s.start_time?.slice(0,5)}</TableCell>
                <TableCell>{s.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.origin} → {s.destination}</TableCell>
                <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
