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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { QuickViewDialog } from "@/components/QuickViewDialog";

export const Route = createFileRoute("/operacao")({ component: Operacao });

function Operacao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ vehicle_id: "", operation_type: "privado", km_initial: 0 });
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);

  const { data: shift } = useQuery({
    queryKey: ["shift-open", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("tvde_shifts").select("*").is("closed_at", null).order("created_at",{ascending:false}).limit(1).maybeSingle()).data,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["veh-op"],
    queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model,active").order("plate")).data ?? [],
  });
  const activeVehicles = vehicles.filter((v: any) => v.active !== false);
  const { data: myOCs = [] } = useQuery({
    queryKey: ["my-ocs", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("service_orders").select("id,oc_code,voucher_code,service_date,start_time,origin,destination,status,notes,total_amount,clients(name)").order("service_date", { ascending: false }).limit(20)).data ?? [],
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

  const saveOC = useMutation({
    mutationFn: async () => {
      const payload: any = {
        oc_code: editing.oc_code, voucher_code: editing.voucher_code,
        service_date: editing.service_date, start_time: editing.start_time,
        origin: editing.origin, destination: editing.destination, notes: editing.notes,
      };
      const { error } = await supabase.from("service_orders").update(payload).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); setEditing(null); qc.invalidateQueries({ queryKey: ["my-ocs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const delOC = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["my-ocs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Turnos Motorista" description="Painel de controlo: todos os turnos (Privado, TVDE, Interno) de todos os motoristas no período." />

      <AllShiftsPanel />


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
                <SelectTrigger><SelectValue placeholder={activeVehicles.length ? "—" : "Sem veículos cadastrados"} /></SelectTrigger>
                <SelectContent>{activeVehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand ?? ""} {v.model ?? ""}</SelectItem>)}</SelectContent>
              </Select>
              {activeVehicles.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Cadastre um veículo em <Link to="/cadastros" className="underline">Cadastros → Veículos</Link>.
                </p>
              )}
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
          <TableHeader><TableRow><TableHead>OC</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Trajeto</TableHead><TableHead>Estado</TableHead><TableHead className="w-32 text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {myOCs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem serviços.</TableCell></TableRow>}
            {myOCs.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell><Link to="/oc/$id" params={{ id: s.id }} className="text-primary hover:underline font-mono text-xs">{s.oc_code}</Link></TableCell>
                <TableCell>{s.service_date} {s.start_time?.slice(0,5)}</TableCell>
                <TableCell>{s.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.origin} → {s.destination}</TableCell>
                <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(s)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Editar" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Excluir" onClick={() => { if (confirm(`Excluir OC ${s.oc_code}?`)) delOC.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar OC {editing?.oc_code}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nº OC</Label><Input value={editing.oc_code ?? ""} onChange={(e) => setEditing({ ...editing, oc_code: e.target.value })} /></div>
              <div><Label>Voucher</Label><Input value={editing.voucher_code ?? ""} onChange={(e) => setEditing({ ...editing, voucher_code: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={editing.service_date ?? ""} onChange={(e) => setEditing({ ...editing, service_date: e.target.value })} /></div>
              <div><Label>Hora</Label><Input type="time" value={editing.start_time?.slice(0,5) ?? ""} onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} /></div>
              <div><Label>Origem</Label><Input value={editing.origin ?? ""} onChange={(e) => setEditing({ ...editing, origin: e.target.value })} /></div>
              <div><Label>Destino</Label><Input value={editing.destination ?? ""} onChange={(e) => setEditing({ ...editing, destination: e.target.value })} /></div>
              <div className="col-span-2"><Label>Notas</Label>
                <textarea className="w-full min-h-20 rounded-md border border-input bg-background p-2 text-sm" value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => saveOC.mutate()} disabled={saveOC.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Serviço"
        record={viewing}
        fields={[
          { key: "oc_code", label: "Nº OC" },
          { key: "voucher_code", label: "Voucher" },
          { key: "service_date", label: "Data" },
          { key: "start_time", label: "Hora" },
          { key: "origin", label: "Origem" },
          { key: "destination", label: "Destino" },
          { key: "status", label: "Estado" },
          { key: "total_amount", label: "Total" },
          { key: "notes", label: "Notas" },
        ]}
      />
    </div>
  );
}
