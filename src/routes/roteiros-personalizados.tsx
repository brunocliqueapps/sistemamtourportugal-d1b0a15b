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
import { Plus, Pencil, Trash2, Eye, FileDown, Lock } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import { useUnsavedChanges } from "@/lib/unsaved-changes-context";
import { buildDays, daysBetween, type ItineraryDay } from "@/lib/payment-terms";

import { generateProposalPdf } from "@/lib/proposal-pdf";
import { shortCode } from "@/lib/codes";
import { fmtDate } from "@/lib/format-date";

export const Route = createFileRoute("/roteiros-personalizados")({ component: Propostas });

const empty: any = {
  client_id: "", lead_id: "", status: "rascunho", proposal_kind: "roteiro_personalizado",
  responsible: "", passengers: 1,
  arrival_date: "", arrival_time: "", arrival_place: "",
  departure_date: "", departure_time: "", departure_place: "",
  itinerary_start: "", itinerary_end: "", itinerary: [] as ItineraryDay[],
  region_id: "", tour_route_id: "",

  title: "", descriptive: "", descriptive_service: "",
};

const KINDS = [
  { code: "roteiro_personalizado", label: "Roteiro Personalizado Mtour" },
  { code: "servico_privado", label: "Serviço Privado" },
];


function Propostas() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const qc = useQueryClient();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [search, setSearch] = useState("");
  

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
  const { data: services = [] } = useQuery({ queryKey: ["products_services", "mini"], queryFn: async () => (await supabase.from("products_services").select("id,name").eq("active", true).order("name")).data ?? [] });
  const { data: tourRoutes = [] } = useQuery({ queryKey: ["tour_routes", "list-mini"], queryFn: async () => (await supabase.from("tour_routes").select("*").order("name")).data ?? [] });


  const days = daysBetween(form.itinerary_start, form.itinerary_end);

  function pickClient(id: string) {
    setHasUnsavedChanges(true);
    const c: any = clients.find((x: any) => x.id === id);

    // O lead de origem costuma ter os dados de passageiros/viagem preenchidos
    const l: any = c?.lead_id ? (leads as any[]).find((x: any) => x.id === c.lead_id) : null;
    const pick = (k: string) => c?.[k] ?? l?.[k] ?? null;
    setForm((f: any) => {
      const arrival = pick("arrival_date") ?? f.arrival_date;
      const departure = pick("departure_date") ?? f.departure_date;
      const start = arrival || f.itinerary_start;
      const end = departure || f.itinerary_end;
      return {
        ...f, client_id: id,
        passengers: Number(pick("passengers")) || Number(f.passengers) || 1,
        arrival_date: arrival, arrival_time: pick("arrival_time") ?? f.arrival_time, arrival_place: pick("arrival_place") ?? f.arrival_place,
        departure_date: departure, departure_time: pick("departure_time") ?? f.departure_time, departure_place: pick("departure_place") ?? f.departure_place,
        responsible: f.responsible || c?.name || "",
        itinerary_start: start, itinerary_end: end,
        itinerary: buildDays(start, end, f.itinerary ?? []),
        days_count: daysBetween(start, end) || null,
      };
    });
  }


  function setRange(patch: any) {
    setHasUnsavedChanges(true);
    setForm((f: any) => {

      const next = { ...f, ...patch };
      const list = buildDays(next.itinerary_start, next.itinerary_end, f.itinerary ?? []);
      const n = daysBetween(next.itinerary_start, next.itinerary_end);
      return { ...next, itinerary: list, days_count: n || null };
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const n = daysBetween(form.itinerary_start, form.itinerary_end);
      // Garante que todos os dias do período são gravados (mesmo os não editados)
      const routeById = (id?: string) => (tourRoutes as any[]).find((r) => r.id === id);
      const itinerary = buildDays(form.itinerary_start, form.itinerary_end, (form.itinerary ?? []) as ItineraryDay[])
        .map((d) => {
          const custom = (d.mode ?? "sugestao") === "personalizado";
          const r = custom ? null : routeById(d.tour_route_id);
          return {
            ...d,
            region_id: r?.region_id || d.region_id || "",
            tour_route_id: custom ? "" : (d.tour_route_id || ""),
            text: (d.text && String(d.text).trim()) || r?.name || "",
          };
        });
      const payload: any = {
        ...form,
        itinerary,
        passengers: Number(form.passengers || 0) || null,
        days_count: n || null,
        private_service_text: form.proposal_kind === "servico_privado" ? (form.descriptive_service || null) : null,
      };
      delete payload.descriptive_service;
      delete payload.payment_terms;
      delete payload.total_value;

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
    onSuccess: async () => {
      toast.success(editing ? "Proposta atualizada" : "Proposta gerada");
      qc.invalidateQueries({ queryKey: ["proposals"] });
      setOpen(false); setEditing(null); setForm(empty); setHasUnsavedChanges(false);
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




  function openNew() { setEditing(null); setForm(empty); setOpen(true); setHasUnsavedChanges(false); }
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
      itinerary: buildDays(p.itinerary_start ?? "", p.itinerary_end ?? "", Array.isArray(p.itinerary) ? p.itinerary : []),
      title: p.title ?? "",
      descriptive_service: p.private_service_text ?? "",
      descriptive: p.descriptive ?? "",
    });
    setOpen(true); setHasUnsavedChanges(false);
  }


  const selectedClient: any = clients.find((c: any) => c.id === form.client_id);
  const q = search.trim().toLowerCase();
  const filteredProps = q
    ? (props as any[]).filter((p: any) => [p.code, p.clients?.client_number, p.clients?.name, p.leads?.name, p.clients?.email]
        .some((v: any) => String(v ?? "").toLowerCase().includes(q)))
    : (props as any[]);


  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader title="Roteiros Personalizados" description="Gera propostas de roteiro personalizado ou serviço privado e converte em OS + Voucher + Serviço." actions={
        <Button onClick={openNew} className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-1" /> Roteiro Personalizado</Button>
      } />

      <Card className="p-3 mb-4">
        <Input placeholder="Filtrar por nº de cliente, nome ou email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nº Cliente</TableHead><TableHead>Cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Tipo</TableHead>
            <TableHead>Dias</TableHead>

            <TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredProps.map((p: any) => {
              const approved = ["aprovada", "convertida"].includes(p.status) || !!p.budget_approved_at;
              const locked = approved && !isAdmin;
              return (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{shortCode(p.code ?? p.clients?.client_number)}</TableCell>
                <TableCell className="font-medium">{p.clients?.name ?? p.leads?.name ?? "—"}</TableCell>
                <TableCell>{p.title ?? "—"}</TableCell>
                <TableCell>{KINDS.find((k) => k.code === p.proposal_kind)?.label ?? "—"}</TableCell>
                <TableCell>{p.days_count ?? "—"}</TableCell>
                
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  <Button size="icon" variant="ghost" title="PDF da proposta" onClick={() => generateProposalPdf(p.id, { variant: "roteiro" }).catch((e) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
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

      <Dialog open={open} onOpenChange={(v) => {
        if (!v && useUnsavedChanges().hasUnsavedChanges) {
          if (!confirm("Tem alterações não guardadas. Deseja sair?")) return;
        }
        setOpen(v);
        if (!v) setHasUnsavedChanges(false);
      }}>
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
              <div><Label>Serviço</Label>
                <Select value={form.title ?? ""} onValueChange={(v) => setForm({ ...form, title: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar serviço" /></SelectTrigger>
                  <SelectContent>{services.map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>


            {selectedClient && (
              <div className="rounded-md border p-3 text-xs text-muted-foreground grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>NIF/Passaporte: <span className="text-foreground">{selectedClient.nif ?? "—"}</span></div>
                <div>Telefone: <span className="text-foreground">{[selectedClient.phone_country, selectedClient.phone].filter(Boolean).join(" ") || "—"}</span></div>
                <div>Email: <span className="text-foreground">{selectedClient.email ?? "—"}</span></div>
                <div>Nº de passageiros: <span className="text-foreground">{form.passengers || "—"}</span></div>

                <div>Contacto emergência: <span className="text-foreground">{selectedClient.emergency_contact ?? "—"}</span></div>
                <div className="col-span-2 sm:col-span-3">Chegada: <span className="text-foreground">{[fmtDate(form.arrival_date), form.arrival_time, form.arrival_place].filter(Boolean).join(" · ") || "—"}</span></div>
                <div className="col-span-2 sm:col-span-3">Partida: <span className="text-foreground">{[fmtDate(form.departure_date), form.departure_time, form.departure_place].filter(Boolean).join(" · ") || "—"}</span></div>
                <div className="col-span-2 sm:col-span-3 border-t pt-2">Notas do cliente: <span className="text-foreground whitespace-pre-wrap">{selectedClient.notes?.trim() || (leads as any[]).find((l: any) => l.id === (selectedClient.lead_id ?? form.lead_id))?.notes?.trim() || "—"}</span></div>
              </div>
            )}

            <div>
              <div className="text-sm font-medium mb-2">Tipo e Roteiro</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2"><Label>Opção</Label>
                  <Select value={form.proposal_kind} onValueChange={(v) => setForm({ ...form, proposal_kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="roteiro_personalizado">Roteiro Personalizado Mtour</SelectItem>
                      <SelectItem value="servico_privado">Serviço Privado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Início</Label><Input type="date" value={form.itinerary_start} onChange={(e) => setRange({ itinerary_start: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="date" value={form.itinerary_end} onChange={(e) => setRange({ itinerary_end: e.target.value })} /></div>

                {form.proposal_kind === "servico_privado" && (
                  <div className="sm:col-span-4"><Label>Descrição do serviço privado</Label>
                    <Textarea rows={2} placeholder="Descreva o serviço privado" value={form.descriptive_service ?? ""} onChange={(e) => setForm({ ...form, descriptive_service: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-2">Quantidade de dias: <span className="font-semibold text-foreground">{days || 0}</span></div>

              {(form.itinerary ?? []).filter((d: ItineraryDay) => !d.deleted).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(form.itinerary as ItineraryDay[]).filter((d: ItineraryDay) => !d.deleted).map((d, i) => {
                    const patch = (v: Partial<ItineraryDay>) => {
                      const list = [...(form.itinerary as ItineraryDay[])];
                      const idx = list.findIndex((x) => x.date === d.date && !x.deleted);
                      if (idx >= 0) list[idx] = { ...list[idx], ...v };
                      setForm({ ...form, itinerary: list });
                    };
                    const removeDay = () => {
                      const list = [...(form.itinerary as ItineraryDay[])];
                      const idx = list.findIndex((x) => x.date === d.date && !x.deleted);
                      if (idx >= 0) list[idx] = { ...list[idx], deleted: true };
                      setForm({ ...form, itinerary: list });
                    };
                    const custom = (d.mode ?? "sugestao") === "personalizado";
                    return (
                      <div key={d.date} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                            <div><Label className="text-xs">Dia {i + 1} — data</Label>
                              <Input type="date" value={d.date} onChange={(e) => patch({ date: e.target.value })} />
                            </div>
                            <div><Label className="text-xs">Roteiro do dia</Label>
                              <Select
                                value={custom ? "outros" : (d.tour_route_id || "")}
                                onValueChange={(v) => {
                                  if (v === "outros") return patch({ mode: "personalizado", tour_route_id: "", region_id: "" });
                                  const r = (tourRoutes as any[]).find((x) => x.id === v);
                                  patch({ mode: "sugestao", region_id: r?.region_id ?? "", tour_route_id: v, text: r?.name ?? "" });
                                }}
                              >
                                <SelectTrigger><SelectValue placeholder="Selecionar roteiro" /></SelectTrigger>
                                <SelectContent>
                                  {(tourRoutes as any[]).map((r: any) => (
                                    <SelectItem key={r.id} value={r.id}>
                                      {[(regions as any[]).find((g: any) => g.id === r.region_id)?.name, r.name].filter(Boolean).join(" · ")}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="outros">Outros (personalizar)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" className="shrink-0 text-destructive" title="Eliminar dia" onClick={removeDay}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {custom && (
                          <Textarea rows={2} placeholder="Descreva o programa deste dia" value={d.text} onChange={(e) => patch({ text: e.target.value })} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(form.itinerary ?? []).filter((d: ItineraryDay) => d.deleted).length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-muted-foreground">Dias eliminados — clique em + para repor</div>
                  {(form.itinerary as ItineraryDay[]).map((d, idx) => ({ d, idx })).filter(({ d }) => d.deleted).map(({ d, idx }) => (
                    <div key={`del-${d.date}-${idx}`} className="flex items-center justify-between gap-2 rounded-md border border-dashed p-2 text-sm">
                      <span className="text-muted-foreground">{fmtDate(d.date)}</span>
                      <Button size="icon" variant="ghost" title="Repor dia" onClick={() => {
                        const list = [...(form.itinerary as ItineraryDay[])];
                        list[idx] = { ...list[idx], deleted: false };
                        setForm({ ...form, itinerary: list });
                      }}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

            </div>

            <div><Label>Descritivo à parte</Label><Textarea rows={3} value={form.descriptive} onChange={(e) => setForm({ ...form, descriptive: e.target.value })} /></div>

            <p className="text-xs text-muted-foreground">
              O valor total e as condições de pagamento são definidos na página Proposta/Orçamento.
            </p>


          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1 text-xs text-muted-foreground hidden sm:block">
              Clique em Guardar para não perder as informações registadas.
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              {editing?.id && (
                <Button variant="outline" onClick={() => generateProposalPdf(editing.id, { variant: "roteiro" }).catch((e: any) => toast.error(e.message))}>
                  <FileDown className="h-4 w-4 mr-1" /> PDF
                </Button>
              )}
              <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={!form.client_id || save.isPending}>
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Proposta"
        record={viewing}
        fields={[
          { key: "code", label: "Nº Cliente / Proposta", format: (v: any) => shortCode(v) },
          { key: "title", label: "Serviço" },
          { key: "clients", label: "Cliente", format: (v, r) => v?.name ?? r?.leads?.name ?? "—" },
          { key: "passengers", label: "Nº de pessoas" },
          { key: "proposal_kind", label: "Tipo", format: (v) => KINDS.find((k) => k.code === v)?.label ?? v },
          { key: "arrival_date", label: "Chegada", format: (v, r) => [fmtDate(v), r?.arrival_time, r?.arrival_place].filter(Boolean).join(" · ") || "—" },
          { key: "departure_date", label: "Saída", format: (v, r) => [fmtDate(v), r?.departure_time, r?.departure_place].filter(Boolean).join(" · ") || "—" },
          { key: "days_count", label: "Dias" },
          {
            key: "itinerary",
            label: "Roteiro",
            fullWidth: true,
            format: (v, r) => {
              const list = Array.isArray(v) ? v.filter((d: any) => !d.deleted) : [];
              if (!list.length) return "—";
              const fallback = r?.tour_routes?.name ?? "";
              return (
                <div className="space-y-1">
                  {list.map((d: any, i: number) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:gap-3 border-b border-border/50 pb-1 last:border-0">
                      <span className="shrink-0 text-xs text-muted-foreground sm:w-40">Dia {i + 1} · {fmtDate(d.date) || "—"}</span>
                      <span className="min-w-0 break-words">{(d.text && d.text.trim()) || fallback || "—"}</span>
                    </div>
                  ))}
                </div>
              );
            },
          },
          { key: "descriptive", label: "Descritivo", fullWidth: true },
        ]}

      />
    </div>
  );
}
