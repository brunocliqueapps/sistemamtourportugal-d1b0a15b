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
import { Pencil, Trash2, Eye, CheckCircle2 } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/oc")({ component: OCList });

const OP_FALLBACK = ["agendado","em_execucao","finalizado","no_show","cancelado","reagendado"];
const FIN_FALLBACK = ["nao_faturado","faturado","pago"];

function OCList() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});

  const { data = [] } = useQuery({
    queryKey: ["service-orders"],
    queryFn: async () => (await supabase.from("service_orders").select("*, clients(name), drivers(full_name), vehicles(plate)").order("service_date", { ascending: false })).data ?? [],
  });
  const { data: drivers = [] } = useQuery({ queryKey: ["drivers-mini"], queryFn: async () => (await supabase.from("drivers").select("id,full_name").order("full_name")).data ?? [] });
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles-mini"], queryFn: async () => (await supabase.from("vehicles").select("id,plate").order("plate")).data ?? [] });
  const { data: opOpts = [] } = useQuery({ queryKey: ["status-opts","oc_operational_status"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain","oc_operational_status").eq("active",true).order("sort")).data ?? [] });
  const { data: finOpts = [] } = useQuery({ queryKey: ["status-opts","oc_financial_status"], queryFn: async () => (await supabase.from("status_options").select("code,label").eq("domain","oc_financial_status").eq("active",true).order("sort")).data ?? [] });
  const operational = opOpts.length ? opOpts : OP_FALLBACK.map((c) => ({ code: c, label: c }));
  const financial = finOpts.length ? finOpts : FIN_FALLBACK.map((c) => ({ code: c, label: c }));
  const opLabel = (c: string) => operational.find((o: any) => o.code === c)?.label ?? c;
  const finLabel = (c: string) => financial.find((o: any) => o.code === c)?.label ?? c;

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      if (payload.sale_value != null) payload.sale_value = Number(payload.sale_value);
      if (payload.passengers != null) payload.passengers = Number(payload.passengers) || null;
      const { error } = await supabase.from("service_orders").update(payload).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OC atualizada"); qc.invalidateQueries({ queryKey: ["service-orders"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OC removida"); qc.invalidateQueries({ queryKey: ["service-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(s: any) {
    setEditing(s);
    setForm({
      oc_code: s.oc_code ?? "", voucher_code: s.voucher_code ?? "",
      service_date: s.service_date ?? "", start_time: s.start_time ?? "",
      origin: s.origin ?? "", destination: s.destination ?? "",
      passengers: s.passengers ?? "", sale_value: s.sale_value ?? 0,
      driver_id: s.driver_id ?? "", vehicle_id: s.vehicle_id ?? "",
      status: s.status ?? "agendado",
      financial_status: s.financial_status ?? "nao_faturado",
    });
  }

  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").update({ status: "finalizado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pedido concluído"); qc.invalidateQueries({ queryKey: ["service-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 space-y-4">
      <PageHeader title="Ordens de Serviço (OC)" description="Todas as OCs geradas pelas propostas aprovadas." />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>OC</TableHead><TableHead>Voucher</TableHead><TableHead>Data</TableHead>
            <TableHead>Cliente</TableHead><TableHead>Trajeto</TableHead>
            <TableHead>Motorista</TableHead><TableHead>Veículo</TableHead>
            <TableHead>Operacional</TableHead><TableHead>Financeiro</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map((s: any) => {
              const canConcluir = !["finalizado","cancelado","no_show"].includes(s.status);
              return (
              <TableRow key={s.id}>
                <TableCell><Link to="/oc/$id" params={{ id: s.id }} className="text-primary hover:underline font-mono text-xs">{s.oc_code}</Link></TableCell>
                <TableCell className="font-mono text-xs">{s.voucher_code}</TableCell>
                <TableCell>{s.service_date} {s.start_time?.slice(0,5) ?? ""}</TableCell>
                <TableCell>{s.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.origin} → {s.destination}</TableCell>
                <TableCell>{s.drivers?.full_name ?? "—"}</TableCell>
                <TableCell>{s.vehicles?.plate ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{opLabel(s.status)}</Badge></TableCell>
                <TableCell><Badge variant={s.financial_status === "pago" ? "default" : "outline"}>{finLabel(s.financial_status ?? "nao_faturado")}</Badge></TableCell>
                <TableCell className="text-right">€ {Number(s.sale_value||0).toFixed(2)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {canConcluir && (
                    <Button size="sm" variant="outline" title="Concluir pedido" onClick={() => { if (confirm("Concluir este pedido?")) concluir.mutate(s.id); }}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(s)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover esta OC?")) del.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            );})}
            {data.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma OC ainda. Aprove uma proposta para gerar automaticamente.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar OC {editing?.oc_code}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nº OC</Label><Input value={form.oc_code ?? ""} onChange={(e) => setForm({ ...form, oc_code: e.target.value })} /></div>
            <div><Label>Nº Voucher</Label><Input value={form.voucher_code ?? ""} onChange={(e) => setForm({ ...form, voucher_code: e.target.value })} /></div>
            <div><Label>Data</Label><Input type="date" value={form.service_date ?? ""} onChange={(e) => setForm({ ...form, service_date: e.target.value })} /></div>
            <div><Label>Horário</Label><Input type="time" value={form.start_time ?? ""} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            <div><Label>Origem</Label><Input value={form.origin ?? ""} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></div>
            <div><Label>Destino</Label><Input value={form.destination ?? ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
            <div><Label>Passageiros</Label><Input type="number" value={form.passengers ?? ""} onChange={(e) => setForm({ ...form, passengers: e.target.value })} /></div>
            <div><Label>Valor (€)</Label><Input type="number" step="0.01" value={form.sale_value ?? 0} onChange={(e) => setForm({ ...form, sale_value: e.target.value })} /></div>
            <div><Label>Motorista</Label>
              <Select value={form.driver_id ?? ""} onValueChange={(v) => setForm({ ...form, driver_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Veículo</Label>
              <Select value={form.vehicle_id ?? ""} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Estado operacional</Label>
              <Select value={form.status ?? "agendado"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{operational.map((s: any) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Estado financeiro</Label>
              <Select value={form.financial_status ?? "nao_faturado"} onValueChange={(v) => setForm({ ...form, financial_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{financial.map((s: any) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()}>Atualizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Ordem de Serviço"
        record={viewing}
        fields={[
          { key: "oc_code", label: "OC" }, { key: "voucher_code", label: "Voucher" },
          { key: "service_date", label: "Data" }, { key: "start_time", label: "Horário" },
          { key: "clients", label: "Cliente", format: (v) => v?.name ?? "—" },
          { key: "origin", label: "Origem" }, { key: "destination", label: "Destino" },
          { key: "passengers", label: "Passageiros" },
          { key: "drivers", label: "Motorista", format: (v) => v?.full_name ?? "—" },
          { key: "vehicles", label: "Veículo", format: (v) => v?.plate ?? "—" },
          { key: "operation_type", label: "Operação" },
          { key: "status", label: "Estado operacional", format: (v) => opLabel(v) },
          { key: "financial_status", label: "Estado financeiro", format: (v) => finLabel(v ?? "nao_faturado") },
          { key: "sale_value", label: "Valor", format: (v) => `€ ${Number(v || 0).toFixed(2)}` },
        ]}
      />
    </div>
  );
}
