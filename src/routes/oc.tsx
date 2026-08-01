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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Eye, CheckCircle2, Plus, FileDown } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { useState } from "react";
import { toast } from "sonner";
import { shortCode } from "@/lib/codes";
import { generateServiceOrderPdf } from "@/lib/proposal-pdf";

export const Route = createFileRoute("/oc")({ component: OCList });

const OP_FALLBACK = ["para_atendimento","em_atendimento","atendimento_finalizado"];
const FIN_FALLBACK = ["nao_faturado","faturado","pago"];
const OPTYPE_FALLBACK = ["privado","tvde","interno"];

function OCList() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["service-orders"],
    queryFn: async () => (await supabase.from("service_orders").select("*, clients(name,phone,email,client_number), vehicles(plate,brand,model,usage_type,owner_company), proposals(code,title,description,descriptive,proposal_kind,itinerary,payment_terms,passengers,total_value)").order("service_date", { ascending: false })).data ?? [],
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles-mini"], queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model,usage_type,owner_company").order("plate")).data ?? [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients-mini"], queryFn: async () => (await supabase.from("clients").select("id,name,client_number,email").order("name")).data ?? [] });
  const { data: opOpts = [] } = useQuery({ queryKey: ["status-opts","oc_operational_status"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain","oc_operational_status").eq("active",true).order("sort")).data ?? [] });
  const { data: finOpts = [] } = useQuery({ queryKey: ["status-opts","oc_financial_status"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain","oc_financial_status").eq("active",true).order("sort")).data ?? [] });
  const { data: opTypeOpts = [] } = useQuery({ queryKey: ["status-opts","operation_type"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain","operation_type").eq("active",true).order("sort")).data ?? [] });
  const operational = opOpts.length ? opOpts : OP_FALLBACK.map((c) => ({ code: c, label: c }));
  const financial = finOpts.length ? finOpts : FIN_FALLBACK.map((c) => ({ code: c, label: c }));
  const opTypes = opTypeOpts.length ? opTypeOpts : OPTYPE_FALLBACK.map((c) => ({ code: c, label: c }));
  const opLabel = (c: string) => operational.find((o: any) => o.code === c)?.label ?? c;
  const finLabel = (c: string) => financial.find((o: any) => o.code === c)?.label ?? c;

  const q = search.trim().toLowerCase();
  const rows = !q ? (data as any[]) : (data as any[]).filter((s: any) =>
    [s.clients?.client_number, s.clients?.name, s.clients?.email, s.oc_code, s.voucher_code]
      .some((v: any) => String(v ?? "").toLowerCase().includes(q)));

  const fromProposal = !!editing?.id && !!editing?.proposal_id;

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      if (payload.sale_value != null) payload.sale_value = Number(payload.sale_value);
      if (payload.amount_received != null) payload.amount_received = Number(payload.amount_received) || 0;
      if (payload.passengers != null) payload.passengers = Number(payload.passengers) || null;
      if (editing?.id) {
        const { error } = await supabase.from("service_orders").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        if (!payload.operation_type) payload.operation_type = "privado";
        if (!payload.status) payload.status = "para_atendimento";
        if (!payload.financial_status) payload.financial_status = "nao_faturado";
        const { error } = await supabase.from("service_orders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing?.id ? "OS atualizada" : "OS criada"); qc.invalidateQueries({ queryKey: ["service-orders"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OS removida"); qc.invalidateQueries({ queryKey: ["service-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(s: any) {
    setEditing(s);
    setForm({
      oc_code: s.oc_code ?? "", voucher_code: s.voucher_code ?? "",
      service_date: s.service_date ?? "", start_time: s.start_time ?? "",
      origin: s.origin ?? "", destination: s.destination ?? "",
      passengers: s.passengers ?? "", sale_value: s.sale_value ?? 0,
      vehicle_id: s.vehicle_id ?? "",
      client_id: s.client_id ?? "", operation_type: s.operation_type ?? "privado",
      status: s.status ?? "para_atendimento",
      financial_status: s.financial_status ?? "pagar_empresa",
      amount_received: s.amount_received ?? 0,
    });
  }

  function openNew() {
    setEditing({});
    setForm({
      oc_code: "", voucher_code: "",
      service_date: new Date().toISOString().slice(0,10), start_time: "",
      origin: "", destination: "", passengers: "", sale_value: 0,
      vehicle_id: "", client_id: "",
      operation_type: "privado", status: "para_atendimento", financial_status: "pagar_empresa", amount_received: 0,
    });
  }

  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").update({ status: "atendimento_finalizado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pedido concluído"); qc.invalidateQueries({ queryKey: ["service-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4">
      <PageHeader title="Ordens de Serviço (OS)" description="OSs geradas pelas propostas aprovadas ou criadas manualmente." actions={
        <Button onClick={openNew} className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-1" /> Nova OS</Button>
      } />
      <Card className="p-3">
        <Input placeholder="Filtrar por nº de cliente, nome ou email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nº Cliente</TableHead><TableHead>OS</TableHead><TableHead>Voucher</TableHead><TableHead>Data</TableHead>
            <TableHead>Cliente</TableHead><TableHead>Trajeto</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Operacional</TableHead><TableHead>Financeiro</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((s: any) => {
              const canConcluir = s.status !== "atendimento_finalizado";
              return (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{shortCode(s.clients?.client_number)}</TableCell>
                <TableCell><Link to="/oc/$id" params={{ id: s.id }} className="text-primary hover:underline font-mono text-xs">{shortCode(s.oc_code)}</Link></TableCell>
                <TableCell className="font-mono text-xs">{shortCode(s.voucher_code)}</TableCell>
                <TableCell>{s.service_date} {s.start_time?.slice(0,5) ?? ""}</TableCell>
                <TableCell>{s.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.origin} → {s.destination}</TableCell>
                
                <TableCell>{s.vehicles?.plate ?? "—"}{s.vehicles?.owner_company ? <div className="text-xs text-muted-foreground">{s.vehicles.owner_company}</div> : null}</TableCell>
                <TableCell><Badge variant="outline">{opLabel(s.status)}</Badge></TableCell>
                <TableCell><Badge variant={s.financial_status === "pago" ? "default" : "outline"}>{finLabel(s.financial_status ?? "nao_faturado")}</Badge></TableCell>
                <TableCell className="text-right">€ {Number(s.sale_value||0).toFixed(2)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {canConcluir && (
                    <Button size="sm" variant="outline" title="Concluir pedido" onClick={() => { if (confirm("Concluir este pedido?")) concluir.mutate(s.id); }}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" title="Descarregar PDF" onClick={() => generateServiceOrderPdf(s.id).catch((e: any) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(s)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover esta OS?")) del.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            );})}
            {rows.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma OS ainda. Aprove uma proposta para gerar automaticamente.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? `Editar OS ${editing?.oc_code ?? ""}` : "Nova OS"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2 rounded-lg border p-3 bg-muted/40 space-y-1 text-sm">
              <div className="font-semibold">
                Cliente: {editing?.clients?.name ?? clients.find((c: any) => c.id === form.client_id)?.name ?? "—"}
                {editing?.clients?.client_number ? ` · Nº ${shortCode(editing.clients.client_number)}` : ""}
              </div>
              {editing?.clients?.phone && <div><b>Contacto:</b> {editing.clients.phone}{editing?.clients?.email ? ` · ${editing.clients.email}` : ""}</div>}
              <div><b>Proposta:</b> {shortCode(editing?.proposals?.code)} · <b>Orçamento:</b> € {Number(editing?.sale_value ?? editing?.proposals?.total_value ?? 0).toFixed(2)}</div>
              <div><b>Data / hora:</b> {editing?.service_date ?? form.service_date ?? "—"} {editing?.start_time ?? ""}</div>
              <div><b>Trajeto:</b> {editing?.origin ?? "—"} → {editing?.destination ?? "—"}</div>
              <div><b>Passageiros:</b> {editing?.passengers ?? editing?.proposals?.passengers ?? "—"}</div>
              {editing?.proposals?.payment_terms && <div><b>Pagamento:</b> {editing.proposals.payment_terms}</div>}
              {(editing?.proposals?.descriptive || editing?.proposals?.description) && <div><b>Descritivo:</b> {editing.proposals.descriptive ?? editing.proposals.description}</div>}
              {Array.isArray(editing?.proposals?.itinerary) && editing.proposals.itinerary.length > 0 && (
                <div>
                  <b>Serviço contratado:</b>
                  <ul className="list-disc pl-5">
                    {editing.proposals.itinerary.map((d: any, i: number) => (
                      <li key={i}>{d.date ?? `Dia ${i + 1}`} — {d.text ?? d.title ?? d.description ?? ""}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {!fromProposal && (<>
            <div><Label>Nº OS</Label><Input value={form.oc_code ?? ""} onChange={(e) => setForm({ ...form, oc_code: e.target.value })} placeholder="auto se vazio" /></div>
            <div><Label>Nº Voucher</Label><Input value={form.voucher_code ?? ""} onChange={(e) => setForm({ ...form, voucher_code: e.target.value })} placeholder="auto se vazio" /></div>
            <div className="col-span-1 sm:col-span-2"><Label>Cliente</Label>
              <Select value={form.client_id ?? ""} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            </>)}
            <div><Label>Veículo</Label>
              <Select value={form.vehicle_id ?? ""} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand ?? ""} {v.model ?? ""}{v.owner_company ? ` — ${v.owner_company}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Estado operacional</Label>
              <Select value={form.status ?? "para_atendimento"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{operational.map((s: any) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Estado financeiro</Label>
              <Select value={form.financial_status ?? "pagar_empresa"} onValueChange={(v) => setForm({ ...form, financial_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{financial.map((s: any) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(form.financial_status === "receber_maos" || form.financial_status === "pago") && (
              <div><Label>Valor recebido (€)</Label>
                <Input type="number" step="0.01" value={form.amount_received ?? 0} onChange={(e) => setForm({ ...form, amount_received: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            {editing?.id && (
              <Button variant="outline" onClick={() => generateServiceOrderPdf(editing.id).catch((e: any) => toast.error(e.message))}>
                <FileDown className="h-4 w-4 mr-1" /> Descarregar PDF
              </Button>
            )}
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()}>{editing?.id ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Ordem de Serviço"
        record={viewing ? { ...viewing, oc_code: shortCode(viewing.oc_code), voucher_code: shortCode(viewing.voucher_code) } : null}
        fields={[
          { key: "oc_code", label: "OS" }, { key: "voucher_code", label: "Voucher" },
          { key: "service_date", label: "Data" }, { key: "start_time", label: "Horário" },
          { key: "clients", label: "Cliente", format: (v) => v?.name ?? "—" },
          { key: "origin", label: "Origem" }, { key: "destination", label: "Destino" },
          { key: "passengers", label: "Passageiros" },
          
          { key: "vehicles", label: "Veículo", format: (v: any) => v ? `${v.plate}${v.owner_company ? " — " + v.owner_company : ""}` : "—" },
          { key: "operation_type", label: "Operação" },
          { key: "status", label: "Estado operacional", format: (v) => opLabel(v) },
          { key: "financial_status", label: "Estado financeiro", format: (v) => finLabel(v ?? "nao_faturado") },
          { key: "sale_value", label: "Valor", format: (v) => `€ ${Number(v || 0).toFixed(2)}` },
        ]}
      />
    </div>
  );
}
