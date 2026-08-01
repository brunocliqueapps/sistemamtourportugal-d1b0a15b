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
import { Plus, Check, Pencil, Trash2, Eye, FileDown, Lock } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import { buildDays, daysBetween, suggestPaymentTerms, type ItineraryDay } from "@/lib/payment-terms";
import { generateProposalPdf } from "@/lib/proposal-pdf";

export const Route = createFileRoute("/propostas")({ component: Propostas });

const empty: any = {
  client_id: "", lead_id: "", status: "rascunho", proposal_kind: "roteiro_personalizado",
  responsible: "", passengers: 1,
  arrival_date: "", arrival_time: "", arrival_place: "",
  departure_date: "", departure_time: "", departure_place: "",
  itinerary_start: "", itinerary_end: "", itinerary: [] as ItineraryDay[],
  region_id: "", tour_route_id: "",

  descriptive: "", payment_terms: "", total_value: 0,
};

const KINDS = [
  { code: "roteiro_personalizado", label: "Roteiro Personalizado" },
  { code: "servico_privado", label: "Serviço Privado" },
];

function Propostas() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
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
  const { data: leads = [] } = useQuery({ queryKey: ["leads-mini"], queryFn: async () => (await supabase.from("leads").select("*").order("created_at", { ascending: false })).data ?? [] });
  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: async () => (await supabase.from("regions").select("*").order("name")).data ?? [] });
  const { data: tourRoutes = [] } = useQuery({ queryKey: ["tour_routes", "list-mini"], queryFn: async () => (await supabase.from("tour_routes").select("*").order("name")).data ?? [] });

  const { data: statusOpts = [] } = useQuery({ queryKey: ["status-opts", "proposal_status"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain", "proposal_status").eq("active", true).order("sort")).data ?? [] });
  const statuses = statusOpts.length ? statusOpts : ["rascunho", "enviada", "aprovada", "convertida", "rejeitada"].map((c) => ({ code: c, label: c }));

  const days = daysBetween(form.itinerary_start, form.itinerary_end);

  function pickClient(id: string) {
    const c: any = clients.find((x: any) => x.id === id);
    // O lead de origem costuma ter os dados de passageiros/viagem preenchidos
    const l: any = c?.lead_id ? (leads as any[]).find((x: any) => x.id === c.lead_id) : null;
    const pick = (k: string) => c?.[k] ?? l?.[k] ?? null;
    setForm((f: any) => ({
      ...f, client_id: id,
      passengers: Number(pick("passengers")) || Number(f.passengers) || 1,
      arrival_date: pick("arrival_date") ?? f.arrival_date, arrival_time: pick("arrival_time") ?? f.arrival_time, arrival_place: pick("arrival_place") ?? f.arrival_place,
      departure_date: pick("departure_date") ?? f.departure_date, departure_time: pick("departure_time") ?? f.departure_time, departure_place: pick("departure_place") ?? f.departure_place,
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
      ["client_id", "lead_id", "arrival_date", "arrival_time", "departure_date", "departure_time", "itinerary_start", "itinerary_end", "region_id", "tour_route_id"].forEach((k) => {
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
      region_id: p.region_id ?? "", tour_route_id: p.tour_route_id ?? "",
      itinerary: Array.isArray(p.itinerary) ? p.itinerary : [],

      descriptive: p.descriptive ?? "", payment_terms: p.payment_terms ?? "", total_value: p.total_value ?? 0,
    });
    setOpen(true);
  }

  const selectedClient: any = clients.find((c: any) => c.id === form.client_id);
  const regionRoutes = (tourRoutes as any[]).filter((r) => r.region_id === form.region_id);


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
            {props.map((p: any) => {
              const approved = ["aprovada", "convertida"].includes(p.status) || !!p.budget_approved_at;
              const locked = approved && !isAdmin;
              return (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code ?? p.clients?.client_number ?? "—"}</TableCell>
                <TableCell className="font-medium">{p.clients?.name ?? p.leads?.name ?? "—"}</TableCell>
                <TableCell>{KINDS.find((k) => k.code === p.proposal_kind)?.label ?? "—"}</TableCell>
                <TableCell>{p.days_count ?? "—"}</TableCell>
                <TableCell className="text-right">€ {Number(p.total_value).toFixed(2)}</TableCell>
                <TableCell><Badge variant={p.status === "convertida" ? "default" : "outline"}>{p.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  {p.status !== "convertida" && !locked && (
                    <Button size="sm" variant="outline" onClick={() => setApproveOpen(p)}><Check className="h-3 w-3 mr-1" /> Aprovar</Button>
                  )}
                  <Button size="icon" variant="ghost" title="PDF da proposta" onClick={() => generateProposalPdf(p.id).catch((e) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(p)}><Eye className="h-4 w-4" /></Button>
                  {locked ? (
                    <Badge variant="outline" className="ml-1"><Lock className="h-3 w-3 mr-1" /> Só admin</Badge>
                  ) : (<>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover esta proposta?")) del.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </>)}
                </TableCell>
              </TableRow>
            );})}
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
                <div>Nº de passageiros: <span className="text-foreground">{form.passengers || "—"}</span></div>
                <div>Responsável: <span className="text-foreground">{form.responsible || selectedClient.name || "—"}</span></div>
                <div>Contacto emergência: <span className="text-foreground">{selectedClient.emergency_contact ?? "—"}</span></div>
                <div className="col-span-2 sm:col-span-3">Chegada: <span className="text-foreground">{[form.arrival_date, form.arrival_time, form.arrival_place].filter(Boolean).join(" · ") || "—"}</span></div>
                <div className="col-span-2 sm:col-span-3">Partida: <span className="text-foreground">{[form.departure_date, form.departure_time, form.departure_place].filter(Boolean).join(" · ") || "—"}</span></div>
              </div>
            )}

            <div>
              <div className="text-sm font-medium mb-2">Tipo e Roteiro</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2"><Label>Opção</Label>
                  <Select value={form.proposal_kind} onValueChange={(v) => setForm({ ...form, proposal_kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="roteiro_personalizado">Sugestão Roteiro Mtour</SelectItem>
                      <SelectItem value="servico_privado">Serviço Privado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Início</Label><Input type="date" value={form.itinerary_start} onChange={(e) => setRange({ itinerary_start: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="date" value={form.itinerary_end} onChange={(e) => setRange({ itinerary_end: e.target.value })} /></div>

                {form.proposal_kind === "servico_privado" ? (
                  <div className="sm:col-span-4"><Label>Serviço privado</Label>
                    <Textarea rows={2} placeholder="Descreva o serviço privado" value={form.descriptive_service ?? ""} onChange={(e) => setForm({ ...form, descriptive_service: e.target.value })} />
                  </div>
                ) : (<>
                  <div className="sm:col-span-2"><Label>Região</Label>
                    <Select value={form.region_id} onValueChange={(v) => setForm({ ...form, region_id: v, tour_route_id: "" })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar região" /></SelectTrigger>
                      <SelectContent>{regions.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2"><Label>Roteiro</Label>
                    <Select value={form.tour_route_id} onValueChange={(v) => setForm({ ...form, tour_route_id: v })} disabled={!form.region_id}>
                      <SelectTrigger><SelectValue placeholder={form.region_id ? "Selecionar roteiro" : "Escolha a região primeiro"} /></SelectTrigger>
                      <SelectContent>{regionRoutes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>)}
              </div>
              <div className="text-xs text-muted-foreground mt-2">Quantidade de dias: <span className="font-semibold text-foreground">{days || 0}</span></div>

              {(form.itinerary ?? []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(form.itinerary as ItineraryDay[]).map((d, i) => {
                    const patch = (v: Partial<ItineraryDay>) => {
                      const list = [...(form.itinerary as ItineraryDay[])];
                      list[i] = { ...list[i], ...v };
                      setForm({ ...form, itinerary: list });
                    };
                    const dayRoutes = (tourRoutes as any[]).filter((r) => r.region_id === (d.region_id || form.region_id));
                    const custom = (d.mode ?? "sugestao") === "personalizado";
                    return (
                      <div key={d.date} className="rounded-md border p-3 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div><Label className="text-xs">Dia {i + 1} — data</Label>
                            <Input type="date" value={d.date} onChange={(e) => patch({ date: e.target.value })} />
                          </div>
                          <div><Label className="text-xs">Roteiro do dia</Label>
                            <Select
                              value={custom ? "outros" : (d.tour_route_id ?? "")}
                              onValueChange={(v) => {
                                if (v === "outros") return patch({ mode: "personalizado", tour_route_id: "" });
                                const r = (tourRoutes as any[]).find((x) => x.id === v);
                                patch({ mode: "sugestao", region_id: d.region_id || form.region_id, tour_route_id: v, text: r?.name ?? d.text });
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecionar roteiro sugerido" /></SelectTrigger>
                              <SelectContent>
                                {dayRoutes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                <SelectItem value="outros">Outros (personalizar)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {custom && (
                          <Textarea rows={2} placeholder="Descreva o programa deste dia" value={d.text} onChange={(e) => patch({ text: e.target.value })} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div><Label>Descritivo à parte</Label><Textarea rows={3} value={form.descriptive} onChange={(e) => setForm({ ...form, descriptive: e.target.value })} /></div>

            <div>
              <Label>Condições de pagamento</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1">Aprovação da Proposta</span>
                  <Input className="w-20" type="number" min={0} max={100} value={pctApproval} onChange={(e) => setPctApproval(e.target.value)} />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1">Final do Serviço</span>
                  <Input className="w-20" type="number" min={0} max={100} value={pctFinal} onChange={(e) => setPctFinal(e.target.value)} />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            <div>
              <Label>Valor total (€)</Label>
              <Input type="number" step="0.01" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">
                Aprovação da Proposta {Number(pctApproval || 0)}% = € {(Number(form.total_value || 0) * Number(pctApproval || 0) / 100).toFixed(2)} · Final do Serviço {Number(pctFinal || 0)}% = € {(Number(form.total_value || 0) * Number(pctFinal || 0) / 100).toFixed(2)}
              </p>
            </div>

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
