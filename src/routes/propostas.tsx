import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Check, Pencil, Trash2, Eye, FileDown } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { buildDays, daysBetween, suggestPaymentTerms, type ItineraryDay } from "@/lib/payment-terms";
import { generateProposalPdf } from "@/lib/proposal-pdf";

export const Route = createFileRoute("/propostas")({ component: Propostas });

const empty: any = {
  client_id: "", lead_id: "", status: "rascunho", proposal_kind: "roteiro_personalizado",
  responsible: "", passengers: 1,
  arrival_date: "", arrival_time: "", arrival_place: "",
  departure_date: "", departure_time: "", departure_place: "",
  itinerary_start: "", itinerary_end: "", itinerary: [] as ItineraryDay[],
  descriptive: "", payment_terms: "", total_value: 0,
};

const KINDS = [
  { code: "roteiro_personalizado", label: "Roteiro Personalizado" },
  { code: "servico_privado", label: "Serviço Privado" },
];

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
    queryFn: async () => (await supabase.from("proposals").select("*, clients(*), leads(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-full-mini"],
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [],
  });
  const { data: leads = [] } = useQuery({ queryKey: ["leads-mini"], queryFn: async () => (await supabase.from("leads").select("id,name").order("created_at", { ascending: false })).data ?? [] });
  const { data: statusOpts = [] } = useQuery({ queryKey: ["status-opts", "proposal_status"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain", "proposal_status").eq("active", true).order("sort")).data ?? [] });
  const statuses = statusOpts.length ? statusOpts : ["rascunho", "enviada", "aprovada", "convertida", "rejeitada"].map((c) => ({ code: c, label: c }));

  const days = daysBetween(form.itinerary_start, form.itinerary_end);

  function pickClient(id: string) {
    const c: any = clients.find((x: any) => x.id === id);
    setForm((f: any) => ({
      ...f, client_id: id,
      passengers: c?.passengers ?? f.passengers,
      arrival_date: c?.arrival_date ?? f.arrival_date, arrival_time: c?.arrival_time ?? f.arrival_time, arrival_place: c?.arrival_place ?? f.arrival_place,
      departure_date: c?.departure_date ?? f.departure_date, departure_time: c?.departure_time ?? f.departure_time, departure_place: c?.departure_place ?? f.departure_place,
      responsible: f.responsible || c?.name || "",
    }));
  }

  function setRange(patch: any) {
    setForm((f: any) => {
      const next = { ...f, ...patch };
      const list = buildDays(next.itinerary_start, next.itinerary_end, f.itinerary ?? []);
      const n = daysBetween(next.itinerary_start, next.itinerary_end);
      return { ...next, itinerary: list, payment_terms: f.payment_terms || suggestPaymentTerms(n || 1) };
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const n = daysBetween(form.itinerary_start, form.itinerary_end);
      const payload: any = {
        ...form,
        total_value: Number(form.total_value || 0),
        passengers: Number(form.passengers || 0) || null,
        days_count: n || null,
        payment_terms: form.payment_terms || suggestPaymentTerms(n || 1),
      };
      ["client_id", "lead_id", "arrival_date", "arrival_time", "departure_date", "departure_time", "itinerary_start", "itinerary_end"].forEach((k) => {
        if (!payload[k]) payload[k] = null;
      });
      if (editing?.id) {
        const { error } = await supabase.from("proposals").update(payload).eq("id", editing.id);
        if (error) throw error;
        return editing.id;
      }
      payload.created_by = user!.id;
      const { data, error } = await supabase.from("proposals").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async (id) => {
      toast.success(editing ? "Proposta atualizada" : "Proposta gerada");
      qc.invalidateQueries({ queryKey: ["proposals"] });
      setOpen(false); setEditing(null); setForm(empty);
      try { await generateProposalPdf(id); } catch { /* PDF opcional */ }
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
        payment_terms: p.payment_terms ?? null,
        status: "agendado", created_by: user!.id,
      });
      if (soErr) throw soErr;
    },
    onSuccess: () => { toast.success("Proposta convertida em OS/Voucher/Serviço"); qc.invalidateQueries(); setApproveOpen(null); },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(p: any) {
    setEditing(p);
    setForm({
      client_id: p.client_id ?? "", lead_id: p.lead_id ?? "", status: p.status ?? "rascunho",
      proposal_kind: p.proposal_kind ?? "roteiro_personalizado", responsible: p.responsible ?? "",
      passengers: p.passengers ?? 1,
      arrival_date: p.arrival_date ?? "", arrival_time: p.arrival_time ?? "", arrival_place: p.arrival_place ?? "",
      departure_date: p.departure_date ?? "", departure_time: p.departure_time ?? "", departure_place: p.departure_place ?? "",
      itinerary_start: p.itinerary_start ?? "", itinerary_end: p.itinerary_end ?? "",
      itinerary: Array.isArray(p.itinerary) ? p.itinerary : [],
      descriptive: p.descriptive ?? "", payment_terms: p.payment_terms ?? "", total_value: p.total_value ?? 0,
    });
    setOpen(true);
  }

  const selectedClient: any = clients.find((c: any) => c.id === form.client_id);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader title="Proposta / Roteiro" description="Gera propostas de roteiro personalizado ou serviço privado e converte em OS + Voucher + Serviço." actions={
        <Button onClick={openNew} className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-1" /> Roteiro Personalizado</Button>
      } />

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nº Cliente</TableHead><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead>
            <TableHead>Dias</TableHead><TableHead className="text-right">Valor</TableHead>
            <TableHead>Estado</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {props.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code ?? p.clients?.client_number ?? "—"}</TableCell>
                <TableCell className="font-medium">{p.clients?.name ?? p.leads?.name ?? "—"}</TableCell>
                <TableCell>{KINDS.find((k) => k.code === p.proposal_kind)?.label ?? "—"}</TableCell>
                <TableCell>{p.days_count ?? "—"}</TableCell>
                <TableCell className="text-right">€ {Number(p.total_value).toFixed(2)}</TableCell>
                <TableCell><Badge variant={p.status === "convertida" ? "default" : "outline"}>{p.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  {p.status !== "convertida" && (
                    <Button size="sm" variant="outline" onClick={() => setApproveOpen(p)}><Check className="h-3 w-3 mr-1" /> Aprovar</Button>
                  )}
                  <Button size="icon" variant="ghost" title="PDF da proposta" onClick={() => generateProposalPdf(p.id).catch((e) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Proposta" : "Roteiro Personalizado"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Cliente</Label>
                <Select value={form.client_id} onValueChange={pickClient}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                  <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.client_number ? `${c.client_number} · ` : ""}{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nº Cliente</Label><Input value={selectedClient?.client_number ?? ""} readOnly /></div>
            </div>

            {selectedClient && (
              <div className="rounded-md border p-3 text-xs text-muted-foreground grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>NIF/Passaporte: <span className="text-foreground">{selectedClient.nif ?? "—"}</span></div>
                <div>Telefone: <span className="text-foreground">{[selectedClient.phone_country, selectedClient.phone].filter(Boolean).join(" ") || "—"}</span></div>
                <div>Email: <span className="text-foreground">{selectedClient.email ?? "—"}</span></div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Nº de pessoas</Label><Input type="number" min={1} value={form.passengers} onChange={(e) => setForm({ ...form, passengers: e.target.value })} /></div>
              <div><Label>Responsável</Label><Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} /></div>
              <div><Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map((s: any) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Dados da viagem</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Data chegada</Label><Input type="date" value={form.arrival_date} onChange={(e) => setForm({ ...form, arrival_date: e.target.value })} /></div>
                <div><Label>Hora chegada</Label><Input type="time" value={form.arrival_time} onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} /></div>
                <div><Label>Local chegada</Label><Input value={form.arrival_place} onChange={(e) => setForm({ ...form, arrival_place: e.target.value })} /></div>
                <div><Label>Data saída</Label><Input type="date" value={form.departure_date} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} /></div>
                <div><Label>Hora saída</Label><Input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} /></div>
                <div><Label>Local saída</Label><Input value={form.departure_place} onChange={(e) => setForm({ ...form, departure_place: e.target.value })} /></div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Tipo e programa</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2"><Label>Opção</Label>
                  <Select value={form.proposal_kind} onValueChange={(v) => setForm({ ...form, proposal_kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{KINDS.map((k) => <SelectItem key={k.code} value={k.code}>{k.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Início</Label><Input type="date" value={form.itinerary_start} onChange={(e) => setRange({ itinerary_start: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="date" value={form.itinerary_end} onChange={(e) => setRange({ itinerary_end: e.target.value })} /></div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">Quantidade de dias: <span className="font-semibold text-foreground">{days || 0}</span></div>

              {(form.itinerary ?? []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(form.itinerary as ItineraryDay[]).map((d, i) => (
                    <div key={d.date} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 items-start">
                      <Input type="date" value={d.date} onChange={(e) => {
                        const list = [...form.itinerary]; list[i] = { ...list[i], date: e.target.value }; setForm({ ...form, itinerary: list });
                      }} />
                      <Textarea rows={2} placeholder={`Dia ${i + 1} — programa`} value={d.text} onChange={(e) => {
                        const list = [...form.itinerary]; list[i] = { ...list[i], text: e.target.value }; setForm({ ...form, itinerary: list });
                      }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div><Label>Descritivo à parte</Label><Textarea rows={3} value={form.descriptive} onChange={(e) => setForm({ ...form, descriptive: e.target.value })} /></div>
            <div><Label>Condições de pagamento</Label>
              <Textarea rows={2} value={form.payment_terms || suggestPaymentTerms(days || 1)} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Sugestão automática: {suggestPaymentTerms(days || 1)}</p>
            </div>
            <div><Label>Valor total (€)</Label><Input type="number" step="0.01" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={!form.client_id || save.isPending}>
              {editing ? "Atualizar proposta" : "Gerar proposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!approveOpen} onOpenChange={(v) => !v && setApproveOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprovar e converter em OS</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          { key: "code", label: "Nº Cliente / Proposta" },
          { key: "clients", label: "Cliente", format: (v, r) => v?.name ?? r?.leads?.name ?? "—" },
          { key: "responsible", label: "Responsável" },
          { key: "passengers", label: "Nº de pessoas" },
          { key: "proposal_kind", label: "Tipo", format: (v) => KINDS.find((k) => k.code === v)?.label ?? v },
          { key: "arrival_date", label: "Chegada", format: (v, r) => [v, r?.arrival_time, r?.arrival_place].filter(Boolean).join(" · ") || "—" },
          { key: "departure_date", label: "Saída", format: (v, r) => [v, r?.departure_time, r?.departure_place].filter(Boolean).join(" · ") || "—" },
          { key: "days_count", label: "Dias" },
          { key: "itinerary", label: "Roteiro", format: (v) => Array.isArray(v) && v.length ? v.map((d: any) => `${d.date}: ${d.text}`).join("\n") : "—" },
          { key: "descriptive", label: "Descritivo" },
          { key: "payment_terms", label: "Condições de pagamento" },
          { key: "total_value", label: "Valor", format: (v) => `€ ${Number(v || 0).toFixed(2)}` },
          { key: "status", label: "Estado", format: (v) => statuses.find((s: any) => s.code === v)?.label ?? v },
        ]}
      />
    </div>
  );
}
