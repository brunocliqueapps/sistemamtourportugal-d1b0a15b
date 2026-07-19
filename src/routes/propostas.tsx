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
import { Plus, Check, Pencil, Trash2, Eye } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/propostas")({ component: Propostas });

const empty = { title: "", description: "", total_value: 0, client_id: "", lead_id: "", status: "rascunho", proposal_type: "servico", tour_route_id: "", tour_route_custom: "" };

function Propostas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [approveOpen, setApproveOpen] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [srv, setSrv] = useState<any>({ service_date: new Date().toISOString().slice(0, 10), start_time: "", origin: "", destination: "", passengers: 1 });

  const { data: props = [] } = useQuery({
    queryKey: ["proposals"],
    queryFn: async () => (await supabase.from("proposals").select("*, clients(name), leads(name), tour_routes(name,region)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients = [] } = useQuery({ queryKey: ["clients-mini"], queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data ?? [] });
  const { data: leads = [] } = useQuery({ queryKey: ["leads-mini"], queryFn: async () => (await supabase.from("leads").select("id,name").order("created_at",{ascending:false})).data ?? [] });
  const { data: routes = [] } = useQuery({ queryKey: ["tour-routes-mini"], queryFn: async () => (await supabase.from("tour_routes").select("id,name,region,default_price").eq("active", true).order("region").order("name")).data ?? [] });
  const { data: statusOpts = [] } = useQuery({ queryKey: ["status-opts","proposal_status"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain","proposal_status").eq("active",true).order("sort")).data ?? [] });
  const statuses = statusOpts.length ? statusOpts : ["rascunho","enviada","aprovada","convertida","rejeitada"].map((c) => ({ code: c, label: c }));

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, total_value: Number(form.total_value || 0) };
      if (!payload.client_id) payload.client_id = null;
      if (!payload.lead_id) payload.lead_id = null;
      if (!payload.tour_route_id) payload.tour_route_id = null;
      if (payload.proposal_type !== "roteiro") { payload.tour_route_id = null; payload.tour_route_custom = null; }
      if (editing?.id) {
        const { error } = await supabase.from("proposals").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user!.id;
        const { error } = await supabase.from("proposals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Proposta atualizada" : "Proposta criada");
      qc.invalidateQueries({ queryKey: ["proposals"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Proposta removida"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
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

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(p: any) {
    setEditing(p);
    setForm({
      title: p.title ?? "", description: p.description ?? "", total_value: p.total_value ?? 0,
      client_id: p.client_id ?? "", lead_id: p.lead_id ?? "", status: p.status ?? "rascunho",
      proposal_type: p.proposal_type ?? "servico", tour_route_id: p.tour_route_id ?? "", tour_route_custom: p.tour_route_custom ?? "",
    });
    setOpen(true);
  }

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Propostas" description="Cria, aprova e converte automaticamente em OC + Voucher + Serviço." actions={
        <Button onClick={openNew} className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-1" /> Nova proposta</Button>
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
                <TableCell className="text-right space-x-1">
                  {p.status !== "convertida" && (
                    <Button size="sm" variant="outline" onClick={() => setApproveOpen(p)}><Check className="h-3 w-3 mr-1" /> Aprovar</Button>
                  )}
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(p)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover esta proposta?")) del.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Proposta" : "Nova Proposta"}</DialogTitle></DialogHeader>
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor total (€)</Label><Input type="number" step="0.01" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: e.target.value })} /></div>
              <div><Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map((s: any) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo de proposta</Label>
                <Select value={form.proposal_type} onValueChange={(v) => setForm({ ...form, proposal_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="roteiro">Roteiro</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.proposal_type === "roteiro" && (
                <div><Label>Roteiro</Label>
                  <Select value={form.tour_route_id || "__custom"} onValueChange={(v) => setForm({ ...form, tour_route_id: v === "__custom" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar roteiro" /></SelectTrigger>
                    <SelectContent>
                      {routes.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.region ? `[${r.region}] ` : ""}{r.name}</SelectItem>
                      ))}
                      <SelectItem value="__custom">➕ Outro (personalizado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {form.proposal_type === "roteiro" && !form.tour_route_id && (
              <div><Label>Roteiro personalizado</Label><Input value={form.tour_route_custom} onChange={(e) => setForm({ ...form, tour_route_custom: e.target.value })} placeholder="Descrever roteiro personalizado" /></div>
            )}
            <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={!form.title}>{editing ? "Atualizar" : "Criar"}</Button>
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

      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Proposta"
        record={viewing}
        fields={[
          { key: "code", label: "Código" }, { key: "title", label: "Título" },
          { key: "clients", label: "Cliente", format: (v, r) => v?.name ?? r?.leads?.name ?? "—" },
          { key: "proposal_type", label: "Tipo" },
          { key: "tour_route_custom", label: "Roteiro personalizado" },
          { key: "total_value", label: "Valor", format: (v) => `€ ${Number(v || 0).toFixed(2)}` },
          { key: "status", label: "Estado" },
          { key: "created_at", label: "Criada em" },
          { key: "approved_at", label: "Aprovada em" },
          { key: "description", label: "Descrição" },
        ]}
      />
    </div>
  );
}
