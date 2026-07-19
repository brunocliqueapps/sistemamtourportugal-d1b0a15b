import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/propostas")({ component: Propostas });

function Propostas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ title: "", description: "", total_value: 0, client_id: "", lead_id: "" });
  const [srv, setSrv] = useState<any>({ service_date: new Date().toISOString().slice(0, 10), start_time: "", origin: "", destination: "", passengers: 1 });

  const { data: props = [] } = useQuery({
    queryKey: ["proposals"],
    queryFn: async () => (await supabase.from("proposals").select("*, clients(name), leads(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients = [] } = useQuery({ queryKey: ["clients-mini"], queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data ?? [] });
  const { data: leads = [] } = useQuery({ queryKey: ["leads-mini"], queryFn: async () => (await supabase.from("leads").select("id,name").order("created_at",{ascending:false})).data ?? [] });

  const create = useMutation({
    mutationFn: async () => {
      const payload = { ...form, created_by: user!.id, total_value: Number(form.total_value || 0) };
      if (!payload.client_id) delete payload.client_id;
      if (!payload.lead_id) delete payload.lead_id;
      const { error } = await supabase.from("proposals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Proposta criada"); qc.invalidateQueries({ queryKey: ["proposals"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async () => {
      const p = approveOpen;
      const { error: upErr } = await supabase.from("proposals").update({ status: "convertida", approved_at: new Date().toISOString() }).eq("id", p.id);
      if (upErr) throw upErr;
      const { error: soErr } = await supabase.from("service_orders").insert({
        proposal_id: p.id, client_id: p.client_id, sale_value: p.total_value,
        service_date: srv.service_date, start_time: srv.start_time || null,
        origin: srv.origin, destination: srv.destination, passengers: Number(srv.passengers) || null,
        status: "agendado", created_by: user!.id,
      });
      if (soErr) throw soErr;
    },
    onSuccess: () => { toast.success("Proposta convertida em OC/Voucher/Serviço"); qc.invalidateQueries(); setApproveOpen(null); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Propostas" description="Cria, aprova e converte automaticamente em OC + Voucher + Serviço." actions={
        <Button onClick={() => setOpen(true)} className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-1" /> Nova proposta</Button>
      } />

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Código</TableHead><TableHead>Título</TableHead><TableHead>Cliente</TableHead>
            <TableHead className="text-right">Valor</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {props.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell>{p.clients?.name ?? p.leads?.name ?? "—"}</TableCell>
                <TableCell className="text-right">€ {Number(p.total_value).toFixed(2)}</TableCell>
                <TableCell><Badge variant={p.status === "convertida" ? "default" : "outline"}>{p.status}</Badge></TableCell>
                <TableCell className="text-right">
                  {p.status !== "convertida" && (
                    <Button size="sm" variant="outline" onClick={() => setApproveOpen(p)}><Check className="h-3 w-3 mr-1" /> Aprovar</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Proposta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cliente</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Lead</Label>
                <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Valor total (€)</Label><Input type="number" step="0.01" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => create.mutate()} disabled={!form.title}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!approveOpen} onOpenChange={(v) => !v && setApproveOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprovar e converter em OC</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data do serviço</Label><Input type="date" value={srv.service_date} onChange={(e) => setSrv({ ...srv, service_date: e.target.value })} /></div>
            <div><Label>Horário</Label><Input type="time" value={srv.start_time} onChange={(e) => setSrv({ ...srv, start_time: e.target.value })} /></div>
            <div><Label>Origem</Label><Input value={srv.origin} onChange={(e) => setSrv({ ...srv, origin: e.target.value })} /></div>
            <div><Label>Destino</Label><Input value={srv.destination} onChange={(e) => setSrv({ ...srv, destination: e.target.value })} /></div>
            <div><Label>Passageiros</Label><Input type="number" value={srv.passengers} onChange={(e) => setSrv({ ...srv, passengers: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(null)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => approve.mutate()}>Gerar OC / Voucher / Serviço</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
