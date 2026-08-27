import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Eye, CheckCircle2, Plus, FileDown, Check, X, ShieldCheck } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { shortCode } from "@/lib/codes";
import { fmtDate } from "@/lib/format-date";
import { generateServiceOrderPdf } from "@/lib/proposal-pdf";
import { useAuth } from "@/lib/auth-context";
import { useUnsavedChanges } from "@/lib/unsaved-changes-context";
import { FINALIZED_STATUS } from "@/lib/finalized";



export const Route = createFileRoute("/oc")({
  component: OCList,
  head: () => ({
    meta: [
      { title: "Ordens de Serviço — Mtour Portugal" },
      { name: "description", content: "Gere as ordens de serviço: cliente, veículo, estado operacional e estado financeiro." },
      { property: "og:title", content: "Ordens de Serviço — Mtour Portugal" },
      { property: "og:description", content: "Ordens de serviço com veículo e estados operacional e financeiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const OP_FALLBACK = ["para_atendimento", "em_atendimento", "atendimento_finalizado"];
const FIN_FALLBACK = ["pagamento_padrao_mtour", "pagamento_a_vista", "recebimento_no_ato", "nao_faturado", "faturado", "pago"];

function OCList() {
  const qc = useQueryClient();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const { user } = useAuth();

  const [selected, setSelected] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState("");
  const [newProposal, setNewProposal] = useState<string>("");


  const PROPOSAL_COLS = "code,title,description,descriptive,proposal_kind,itinerary,itinerary_start,itinerary_end,payment_terms,payment_stages,passengers,total_value,responsible,arrival_date,arrival_time,arrival_place,departure_date,departure_time,departure_place,region_id,tour_route_id,budget_status,budget_validated_at,budget_receipt_info,regions(name),tour_routes(name)";

  const { data = [] } = useQuery({
    queryKey: ["service-orders"],
    queryFn: async () => (await supabase.from("service_orders").select(`*, clients(*), vehicles(plate,brand,model,usage_type,owner_company), proposals(${PROPOSAL_COLS})`).order("service_date", { ascending: false })).data ?? [],
  });
  const { data: validated = [] } = useQuery({
    queryKey: ["proposals-validadas-os"],
    queryFn: async () => (await supabase.from("proposals").select(`id,client_id,${PROPOSAL_COLS},clients(*)`).not("budget_validated_at", "is", null).order("budget_validated_at", { ascending: false })).data ?? [],
  });
  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: async () => (await supabase.from("regions").select("id,name")).data ?? [] });
  const { data: routes = [] } = useQuery({ queryKey: ["tour_routes", "os-mini"], queryFn: async () => (await supabase.from("tour_routes").select("id,name")).data ?? [] });
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles-mini"], queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model,usage_type,owner_company").order("plate")).data ?? [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients-mini"], queryFn: async () => (await supabase.from("clients").select("id,name,client_number,email").order("name")).data ?? [] });
  const { data: opOpts = [] } = useQuery({ queryKey: ["status-opts", "oc_operational_status"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain", "oc_operational_status").eq("active", true).order("sort")).data ?? [] });
  const { data: finOpts = [] } = useQuery({ queryKey: ["status-opts", "oc_financial_status"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain", "oc_financial_status").eq("active", true).order("sort")).data ?? [] });

  const operational = opOpts.length ? opOpts : OP_FALLBACK.map((c) => ({ code: c, label: c }));
  const financial = finOpts.length ? finOpts : FIN_FALLBACK.map((c) => ({ code: c, label: c }));
  const opLabel = (c: string) => operational.find((o: any) => o.code === c)?.label ?? c;
  const finLabel = (c: string) => financial.find((o: any) => o.code === c)?.label ?? c;

  const q = search.trim().toLowerCase();
  const allRows = useMemo(() => !q ? (data as any[]) : (data as any[]).filter((s: any) =>
    [s.clients?.client_number, s.clients?.name, s.clients?.email, s.oc_code]
      .some((v: any) => String(v ?? "").toLowerCase().includes(q))), [data, q]);
  const rows = useMemo(() => allRows.filter((r: any) => r.status !== FINALIZED_STATUS), [allRows]);
  const history = useMemo(() => allRows.filter((r: any) => r.status === FINALIZED_STATUS), [allRows]);

  const s: any = useMemo(() => (data as any[]).find((x: any) => x.id === selected), [data, selected]);
  const editingId = s?.id ?? null;
  const open = creating || !!editingId;


  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      if (payload.amount_received != null) payload.amount_received = Number(payload.amount_received) || 0;
      if (editingId) {
        const { error } = await supabase.from("service_orders").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        if (!payload.operation_type) payload.operation_type = "privado";
        if (!payload.status) payload.status = "para_atendimento";
        if (!payload.financial_status) payload.financial_status = "pagamento_padrao_mtour";
        const { error } = await supabase.from("service_orders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editingId ? "OS atualizada" : "OS criada"); qc.invalidateQueries({ queryKey: ["service-orders"] }); setHasUnsavedChanges(false); close(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OS removida"); qc.invalidateQueries({ queryKey: ["service-orders"] }); close(); },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(row: any) {
    setCreating(false);
    setSelected(row.id);
    setForm({
      client_id: row.client_id ?? "",
      vehicle_id: row.vehicle_id ?? "",
      status: row.status ?? "para_atendimento",
      financial_status: row.financial_status ?? "pagamento_padrao_mtour",
      amount_received: row.amount_received ?? 0,
      financial_receipt_note: row.financial_receipt_note ?? "",
    });
    setHasUnsavedChanges(false);
  }

  function openNew() {
    setSelected("");
    setCreating(true);
    setNewProposal("");
    setForm({
      client_id: "", vehicle_id: "",
      operation_type: "privado", status: "para_atendimento", financial_status: "pagamento_padrao_mtour",
      amount_received: 0, service_date: new Date().toISOString().slice(0, 10),
      financial_receipt_note: "",
    });
    setHasUnsavedChanges(false);
  }

  function pickProposal(pid: string) {
    const pr: any = (validated as any[]).find((x: any) => x.id === pid);
    setNewProposal(pid);
    if (!pr) return;
    setForm((f: any) => ({
      ...f,
      proposal_id: pr.id,
      client_id: pr.client_id ?? "",
      passengers: pr.passengers ?? pr.clients?.passengers ?? null,
      origin: pr.arrival_place ?? null,
      destination: pr.departure_place ?? null,
      service_date: (pr.itinerary_start ?? pr.arrival_date ?? new Date().toISOString()).slice(0, 10),
      start_time: pr.arrival_time ?? null,
      sale_value: Number(pr.total_value ?? 0),
      payment_terms: pr.payment_terms ?? null,
    }));
  }

  function close() {
    setSelected(""); setCreating(false); setForm({}); setNewProposal(""); setHasUnsavedChanges(false);
  }


  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").update({ status: FINALIZED_STATUS }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atendimento finalizado — enviado para o Histórico"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const reabrir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").update({ status: "em_atendimento" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atendimento reaberto"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });


  const validate = useMutation({
    mutationFn: async ({ row, on }: { row: any; on: boolean }) => {
      if (on) {
        const value = Number(row.sale_value ?? row.proposals?.total_value ?? 0);
        if (value <= 0) throw new Error("Defina o valor da OS antes de validar.");
        const { error } = await supabase.from("service_orders").update({ validated_at: new Date().toISOString() }).eq("id", row.id);
        if (error) throw error;
        const { data: exists } = await supabase.from("cash_movements")
          .select("id").eq("service_order_id", row.id).like("description", "Orçamento validado%").maybeSingle();
        if (!exists) {
          const { error: cmErr } = await supabase.from("cash_movements").insert({
            kind: "entrada", amount: value,
            service_order_id: row.id,
            description: `Orçamento validado · Mtour Portugal · ${row.clients?.name ?? "Cliente"} · ${row.proposals?.title ?? shortCode(row.oc_code)}`,
            created_by: user?.id ?? null,
          });
          if (cmErr) throw cmErr;
        }
      } else {
        const { error } = await supabase.from("service_orders").update({ validated_at: null }).eq("id", row.id);
        if (error) throw error;
        await supabase.from("cash_movements").delete().eq("service_order_id", row.id).like("description", "Orçamento validado%");
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.on ? "OS validada e lançada na conta corrente" : "Validação removida");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Proposta/orçamento associado: da OS selecionada ou do orçamento validado escolhido na nova OS
  const chosen: any = useMemo(() => (validated as any[]).find((x: any) => x.id === newProposal), [validated, newProposal]);
  const prop: any = s?.proposals ?? chosen ?? null;
  const cli: any = s?.clients ?? chosen?.clients ?? (clients as any[]).find((c: any) => c.id === form.client_id) ?? null;
  const travelStart = prop?.itinerary_start ?? prop?.arrival_date ?? s?.service_date ?? form.service_date;
  const travelEnd = prop?.itinerary_end ?? prop?.departure_date ?? s?.service_date ?? form.service_date;
  const itDays: any[] = Array.isArray(prop?.itinerary) ? prop.itinerary.filter((d: any) => !d.deleted) : [];
  const regName = (id?: string) => (regions as any[]).find((r: any) => r.id === id)?.name;
  const routeName = (id?: string) => (routes as any[]).find((r: any) => r.id === id)?.name;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader title="Ordens de Serviço (OS)" description="OSs geradas pelos orçamentos validados ou criadas manualmente." actions={
        <Button onClick={openNew} className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-1" /> Nova OS</Button>
      } />

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3"><Label>Filtrar</Label>
            <Input placeholder="Nº de cliente, nome ou email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="sm:col-span-3"><Label>Ordem de serviço</Label>
            <Select value={selected} onValueChange={(v) => { if (hasUnsavedChanges && !confirm("Tem alterações não guardadas. Deseja trocar de OS?")) return; const row = (data as any[]).find((x: any) => x.id === v); if (row) openEdit(row); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar ordem de serviço" /></SelectTrigger>
              <SelectContent>
                {rows.map((x: any) => <SelectItem key={x.id} value={x.id}>{shortCode(x.oc_code)} · {x.clients?.name ?? "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {open && (
          <>
            {creating && (
              <div><Label>Orçamento validado</Label>
                <Select value={newProposal} onValueChange={pickProposal}>
                  <SelectTrigger><SelectValue placeholder="Selecionar orçamento validado" /></SelectTrigger>
                  <SelectContent>
                    {(validated as any[]).map((x: any) => (
                      <SelectItem key={x.id} value={x.id}>
                        {shortCode(x.code)} · {x.clients?.name ?? "—"} · € {Number(x.total_value || 0).toFixed(2)}
                      </SelectItem>
                    ))}
                    {validated.length === 0 && <SelectItem value="none" disabled>Sem orçamentos validados</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(cli || prop) && (
              <div className="rounded-md border p-3 text-sm grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>Nº Cliente: <span className="font-medium">{shortCode(cli?.client_number)}</span></div>
                <div>Cliente: <span className="font-medium">{cli?.name ?? "—"}</span></div>
                <div>NIF/Passaporte: <span className="font-medium">{cli?.nif ?? "—"}</span></div>
                <div>Telefone: <span className="font-medium">{[cli?.phone_country, cli?.phone].filter(Boolean).join(" ") || "—"}</span></div>
                <div>Email: <span className="font-medium">{cli?.email ?? "—"}</span></div>
                <div>Contacto emergência: <span className="font-medium">{cli?.emergency_contact ?? "—"}</span></div>
                <div>Proposta / Orçamento: <span className="font-medium">{prop?.code ? shortCode(prop.code) : "—"}</span></div>
                <div>Passageiros: <span className="font-medium">{s?.passengers ?? form.passengers ?? prop?.passengers ?? cli?.passengers ?? "—"}</span></div>
                <div>Tipo: <span className="font-medium">{prop ? (prop.proposal_kind === "servico_privado" ? "Serviço Privado" : "Roteiro Personalizado") : "—"}</span></div>
                <div>Região: <span className="font-medium">{prop?.regions?.name ?? regName(prop?.region_id) ?? "—"}</span></div>
                <div>Roteiro: <span className="font-medium">{prop?.tour_routes?.name ?? routeName(prop?.tour_route_id) ?? "—"}</span></div>
                <div>Valor: <span className="font-medium">€ {Number(s?.sale_value ?? form.sale_value ?? prop?.total_value ?? 0).toFixed(2)}</span></div>
                <div className="sm:col-span-3">Data da viagem: {[fmtDate(travelStart), fmtDate(travelEnd)].filter(Boolean).join(" → ") || "—"}</div>
                <div className="sm:col-span-3">Chegada: {[fmtDate(prop?.arrival_date), prop?.arrival_time, prop?.arrival_place].filter(Boolean).join(" · ") || "—"}</div>
                <div className="sm:col-span-3">Saída: {[fmtDate(prop?.departure_date), prop?.departure_time, prop?.departure_place].filter(Boolean).join(" · ") || "—"}</div>
                <div className="sm:col-span-3">Trajeto: {(s?.origin ?? form.origin ?? prop?.arrival_place) || "—"} → {(s?.destination ?? form.destination ?? prop?.departure_place) || "—"}</div>
                {(s?.payment_terms || prop?.payment_terms) && <div className="sm:col-span-3">Condições de pagamento: {s?.payment_terms ?? prop?.payment_terms}</div>}
                {prop?.budget_receipt_info && <div className="sm:col-span-3">Recebimento: {prop.budget_receipt_info}</div>}
                {(prop?.descriptive || prop?.description) && <div className="sm:col-span-3 whitespace-pre-wrap">Descritivo: {prop.descriptive ?? prop.description}</div>}
                {cli?.notes && <div className="sm:col-span-3 whitespace-pre-wrap">Notas do cliente: {cli.notes}</div>}
                {s?.financial_receipt_note && <div className="sm:col-span-3 whitespace-pre-wrap">Orientação quanto ao recebimento: {s.financial_receipt_note}</div>}
              </div>
            )}

            {itDays.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead className="w-28">Data</TableHead><TableHead>Serviço contratado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {itDays.map((d: any, i: number) => {
                    const label = [regName(d.region_id || prop?.region_id), routeName(d.tour_route_id)].filter(Boolean).join(" · ");
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{fmtDate(d.date)}</TableCell>
                        <TableCell className="whitespace-pre-wrap">
                          {label}{label && d.text ? " — " : ""}{d.text || (label ? "" : "—")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}


            <div className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label>Cliente</Label>
                <Select value={form.client_id ?? ""} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                  <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{shortCode(c.client_number)} · {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Veículo</Label>
                <Select value={form.vehicle_id ?? ""} onValueChange={(v) => { setForm({ ...form, vehicle_id: v }); setHasUnsavedChanges(true); }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
                  <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand ?? ""} {v.model ?? ""}{v.owner_company ? ` — ${v.owner_company}` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Estado operacional</Label>
                <Select value={form.status ?? "para_atendimento"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{operational.map((o: any) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Estado financeiro</Label>
                <Select value={form.financial_status ?? "pagamento_padrao_mtour"} onValueChange={(v) => { setForm({ ...form, financial_status: v }); setHasUnsavedChanges(true); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{financial.slice(0, 3).map((o: any) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Orientação quanto ao recebimento</Label>
                <Input placeholder="Escreva uma nota sobre o recebimento..." value={form.financial_receipt_note ?? ""} onChange={(e) => { setForm({ ...form, financial_receipt_note: e.target.value }); setHasUnsavedChanges(true); }} />
              </div>
              {(form.financial_status === "recebimento_ato") && (
                <div><Label>Valor recebido (€)</Label>
                  <Input type="number" step="0.01" value={form.amount_received ?? 0} onChange={(e) => setForm({ ...form, amount_received: e.target.value })} />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" onClick={close}><X className="h-4 w-4 mr-1" /> Fechar</Button>
              {editingId && s && s.status !== FINALIZED_STATUS && (
                <Button variant="outline" onClick={() => { if (confirm("Finalizar o atendimento e enviar para o Histórico?")) concluir.mutate(s.id); }}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar Atendimento
                </Button>
              )}
              {editingId && s && (
                <Button variant={s.validated_at ? "secondary" : "default"} onClick={() => validate.mutate({ row: s, on: !s.validated_at })}>
                  <ShieldCheck className="h-4 w-4 mr-1" /> {s.validated_at ? "Anular validação" : "Validar OS"}
                </Button>
              )}

              {editingId && (
                <Button variant="outline" onClick={() => generateServiceOrderPdf(editingId).catch((e: any) => toast.error(e.message))}>
                  <FileDown className="h-4 w-4 mr-1" /> Descarregar PDF
                </Button>
              )}
              <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()}>
                <Check className="h-4 w-4 mr-1" /> {editingId ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>OS</TableHead><TableHead>Data da viagem</TableHead>
            <TableHead>Cliente</TableHead><TableHead>Trajeto</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Operacional</TableHead><TableHead>Financeiro</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => {
              const canConcluir = r.status !== "atendimento_finalizado";
              const start = r.proposals?.itinerary_start ?? r.proposals?.arrival_date ?? r.service_date;
              const end = r.proposals?.itinerary_end ?? r.proposals?.departure_date ?? r.service_date;
              return (
                <TableRow key={r.id}>
                  <TableCell><Link to="/oc/$id" params={{ id: r.id }} className="text-primary hover:underline font-mono text-xs">{shortCode(r.oc_code)}</Link></TableCell>
                  <TableCell className="text-xs leading-tight">
                    <div>Início: {fmtDate(start) || "—"}</div>
                    <div>Fim: {fmtDate(end) || "—"}</div>
                  </TableCell>
                  <TableCell>{r.clients?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{(r.origin ?? r.proposals?.arrival_place) || "—"} → {(r.destination ?? r.proposals?.departure_place) || "—"}</TableCell>
                  <TableCell>{r.vehicles?.plate ?? "—"}{r.vehicles?.owner_company ? <div className="text-xs text-muted-foreground">{r.vehicles.owner_company}</div> : null}</TableCell>
                  <TableCell><Badge variant="outline">{opLabel(r.status)}</Badge></TableCell>
                  <TableCell><Badge variant={r.financial_status === "pago" || r.financial_status === "recebimento_ato" ? "default" : "outline"}>{finLabel(r.financial_status ?? "pagamento_padrao_mtour")}</Badge></TableCell>
                  <TableCell className="text-right">€ {Number(r.sale_value || r.proposals?.total_value || 0).toFixed(2)}</TableCell>

                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" title={r.validated_at ? "Anular validação" : "Validar OS"}
                      onClick={() => validate.mutate({ row: r, on: !r.validated_at })}>
                      <ShieldCheck className={`h-4 w-4 ${r.validated_at ? "text-emerald-600" : ""}`} />
                    </Button>
                    {canConcluir && (
                      <Button size="sm" variant="outline" title="Finalizar Atendimento" onClick={() => { if (confirm("Finalizar o atendimento e enviar para o Histórico?")) concluir.mutate(r.id); }}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Finalizar Atendimento
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="Descarregar PDF" onClick={() => generateServiceOrderPdf(r.id).catch((e: any) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(r)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover esta OS?")) del.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma OS em atendimento. Aprove uma proposta para gerar automaticamente.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-x-auto">
        <div className="p-4 pb-0">
          <div className="font-semibold text-sm">Histórico</div>
          <div className="text-xs text-muted-foreground">Serviços com atendimento finalizado.</div>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>OS</TableHead><TableHead>Data da viagem</TableHead>
            <TableHead>Cliente</TableHead><TableHead>Trajeto</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Financeiro</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {history.map((r: any) => {
              const start = r.proposals?.itinerary_start ?? r.proposals?.arrival_date ?? r.service_date;
              const end = r.proposals?.itinerary_end ?? r.proposals?.departure_date ?? r.service_date;
              return (
                <TableRow key={r.id}>
                  <TableCell><Link to="/oc/$id" params={{ id: r.id }} className="text-primary hover:underline font-mono text-xs">{shortCode(r.oc_code)}</Link></TableCell>
                  <TableCell className="text-xs leading-tight">
                    <div>Início: {fmtDate(start) || "—"}</div>
                    <div>Fim: {fmtDate(end) || "—"}</div>
                  </TableCell>
                  <TableCell>{r.clients?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{(r.origin ?? r.proposals?.arrival_place) || "—"} → {(r.destination ?? r.proposals?.departure_place) || "—"}</TableCell>
                  <TableCell>{r.vehicles?.plate ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{finLabel(r.financial_status ?? "pagamento_padrao_mtour")}</Badge></TableCell>
                  <TableCell className="text-right">€ {Number(r.sale_value || r.proposals?.total_value || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="ghost" title="Reabrir atendimento" onClick={() => { if (confirm("Reabrir este atendimento?")) reabrir.mutate(r.id); }}>Reabrir</Button>
                    <Button size="icon" variant="ghost" title="Descarregar PDF" onClick={() => generateServiceOrderPdf(r.id).catch((e: any) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(r)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {history.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sem serviços finalizados.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>


      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Ordem de Serviço"
        record={viewing ? { ...viewing, oc_code: shortCode(viewing.oc_code) } : null}
        fields={[
          { key: "oc_code", label: "OS" },
          { key: "service_date", label: "Data", format: (_v, r: any) => fmtDate(r?.proposals?.itinerary_start ?? r?.service_date) },
          { key: "start_time", label: "Horário" },
          { key: "clients", label: "Cliente", format: (v) => v?.name ?? "—" },
          { key: "origin", label: "Origem" }, { key: "destination", label: "Destino" },
          { key: "passengers", label: "Passageiros" },
          { key: "vehicles", label: "Veículo", format: (v: any) => v ? `${v.plate}${v.owner_company ? " — " + v.owner_company : ""}` : "—" },
          { key: "operation_type", label: "Operação" },
          { key: "status", label: "Estado operacional", format: (v) => opLabel(v) },
          { key: "financial_status", label: "Estado financeiro", format: (v) => finLabel(v ?? "pagamento_padrao_mtour") },
          { key: "financial_receipt_note", label: "Orientação quanto ao recebimento" },
          { key: "sale_value", label: "Valor", format: (v) => `€ ${Number(v || 0).toFixed(2)}` },
        ]}
      />
    </div>
  );
}
