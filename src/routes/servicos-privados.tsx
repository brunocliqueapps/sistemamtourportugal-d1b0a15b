import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle2, Plus, Trash2, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/servicos-privados")({ component: ServicosPrivados });

const EXPENSE_CATEGORIES = [
  { value: "estacionamento", label: "Estacionamento" },
  { value: "abastecimento", label: "Abastecimento" },
  { value: "portagem", label: "Portagens" },
  { value: "lavagem", label: "Lavagem" },
  { value: "outra", label: "Outras despesas" },
];

function ServicosPrivados() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [status, setStatus] = useState<string>("all");

  const { data: services = [] } = useQuery({
    queryKey: ["priv-services", from, to, status],
    queryFn: async () => {
      let q = supabase.from("service_orders")
        .select("*, clients(name,phone), drivers(full_name), vehicles(plate,brand,model)")
        .or("operation_type.eq.privado,operation_type.is.null")
        .gte("service_date", from).lte("service_date", to)
        .order("service_date", { ascending: false }).order("start_time");
      if (status !== "all") q = q.eq("status", status);
      return (await q).data ?? [];
    },
  });


  const ids = services.map((s: any) => s.id);
  const { data: closings = [] } = useQuery({
    enabled: ids.length > 0,
    queryKey: ["priv-closings", ids.join(",")],
    queryFn: async () => (await supabase.from("service_closings").select("*").in("service_order_id", ids)).data ?? [],
  });

  const closingBy = (id: string) => closings.find((c: any) => c.service_order_id === id);
  const total = services.length;
  const finalizados = services.filter((s: any) => closingBy(s.id)?.closed_at).length;

  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectableIds = services.filter((s: any) => !closingBy(s.id)?.closed_at).map((s: any) => s.id);
  const selectedIds = selectableIds.filter((id: string) => selected[id]);
  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length;
  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    if (v) selectableIds.forEach((id: string) => (next[id] = true));
    setSelected(next);
  };
  const { user } = useAuth();
  const bulkClose = useMutation({
    mutationFn: async () => {
      if (selectedIds.length === 0) throw new Error("Nenhum serviço selecionado.");
      const nowIso = new Date().toISOString();
      for (const id of selectedIds) {
        const svc: any = services.find((s: any) => s.id === id);
        const sale = Number(svc?.sale_value || 0);
        await supabase.from("service_closings").upsert({
          service_order_id: id,
          end_time: nowIso,
          sale_value: sale,
          amount_received: sale,
          balance_pending: 0,
          closed_at: nowIso,
          closed_by: user?.id ?? null,
          notes: "Fechamento em lote",
        }, { onConflict: "service_order_id" });
        await supabase.from("service_orders").update({
          status: "finalizado",
          amount_received: sale,
          amount_pending: 0,
        }).eq("id", id);
      }
    },
    onSuccess: () => {
      toast.success(`${selectedIds.length} serviço(s) fechado(s)`);
      setSelected({});
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title="Serviços Privados"
        description="Ordens de serviço privadas — todo serviço criado aparece aqui automaticamente para fechamento."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="em_execucao">Em execução</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Serviços no período</div><div className="text-2xl font-semibold">{total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Finalizados</div><div className="text-2xl font-semibold text-emerald-600">{finalizados}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-semibold">{total - finalizados}</div></Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedIds.length > 0 ? `${selectedIds.length} selecionado(s)` : "Selecione serviços para fechar em lote"}
        </div>
        <Button
          size="sm"
          disabled={selectedIds.length === 0 || bulkClose.isPending}
          onClick={() => { if (confirm(`Fechar ${selectedIds.length} serviço(s) selecionado(s)?`)) bulkClose.mutate(); }}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" /> Fechar selecionados
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>OC / Voucher</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Motorista / Veículo</TableHead>
              <TableHead>Origem → Destino</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s: any) => {
              const c = closingBy(s.id);
              const isClosed = !!c?.closed_at;
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <Checkbox
                      disabled={isClosed}
                      checked={!!selected[s.id]}
                      onCheckedChange={(v) => setSelected({ ...selected, [s.id]: !!v })}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{s.service_date} {s.start_time?.slice(0, 5)}</TableCell>
                  <TableCell>
                    <Link to="/oc/$id" params={{ id: s.id }} className="font-mono text-primary hover:underline">{s.oc_code}</Link>
                    <div className="text-xs text-muted-foreground">{s.voucher_code}</div>
                  </TableCell>
                  <TableCell>{s.clients?.name ?? "—"}<div className="text-xs text-muted-foreground">{s.clients?.phone ?? ""}</div></TableCell>
                  <TableCell className="text-sm">{s.drivers?.full_name ?? "—"}<div className="text-xs text-muted-foreground">{s.vehicles?.plate ?? ""}</div></TableCell>
                  <TableCell className="text-xs">{s.origin ?? "—"} → {s.destination ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">€ {Number(s.sale_value || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    {isClosed
                      ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Finalizado</Badge>
                      : <Badge variant="outline">{s.status}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <FinalizeDialog service={s} closing={c} />
                  </TableCell>
                </TableRow>
              );
            })}
            {services.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sem serviços privados no período.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}


type ExpenseRow = {
  id?: string; // present if already persisted
  category: string;
  description: string;
  amount: number | string;
  payment_method_id: string;
  paid_by: string;
  vehicle_id: string;
  cost_center_id: string;
};

function FinalizeDialog({ service, closing }: { service: any; closing?: any }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const { data: pm = [] } = useQuery({
    queryKey: ["pm-fin"],
    enabled: open,
    queryFn: async () => (await supabase.from("payment_methods").select("id,name").eq("active", true)).data ?? [],
  });
  const { data: cc = [] } = useQuery({
    queryKey: ["cc-fin"],
    enabled: open,
    queryFn: async () => (await supabase.from("cost_centers").select("id,name").eq("active", true)).data ?? [],
  });
  const { data: vehiclesList = [] } = useQuery({
    queryKey: ["veh-list"],
    enabled: open,
    queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model").order("plate")).data ?? [],
  });
  const { data: profilesList = [] } = useQuery({
    queryKey: ["prof-list"],
    enabled: open,
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,email").order("full_name")).data ?? [],
  });
  const { data: existingExpenses = [] } = useQuery({
    queryKey: ["so-exp", service.id],
    enabled: open,
    queryFn: async () => (await supabase.from("service_expenses").select("*").eq("service_order_id", service.id)).data ?? [],
  });

  const nowIso = () => new Date().toISOString();
  const [form, setForm] = useState<any>(() => ({
    start_time: closing?.start_time ?? nowIso(),
    end_time: closing?.end_time ?? "",
    km_initial: closing?.km_initial ?? 0,
    km_final: closing?.km_final ?? 0,
    amount_received: closing?.amount_received ?? service.sale_value ?? 0,
    payment_method_id: closing?.payment_method_id ?? "",
    received_by: closing?.received_by ?? user?.id ?? "",
    incidents: closing?.incidents ?? "",
    notes: closing?.notes ?? "",
  }));

  const [newExpenses, setNewExpenses] = useState<ExpenseRow[]>([]);

  const kmTraveled = useMemo(() => Math.max(0, Number(form.km_final || 0) - Number(form.km_initial || 0)), [form.km_final, form.km_initial]);
  const saleValue = Number(service.sale_value || 0);
  const balancePending = Math.max(0, saleValue - Number(form.amount_received || 0));

  function addExpense() {
    setNewExpenses([...newExpenses, {
      category: "estacionamento", description: "", amount: 0,
      payment_method_id: "", paid_by: user?.id ?? "", vehicle_id: service.vehicle_id ?? "", cost_center_id: "",
    }]);
  }
  function updateExpense(i: number, patch: Partial<ExpenseRow>) {
    setNewExpenses(newExpenses.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  }
  function removeExpense(i: number) {
    setNewExpenses(newExpenses.filter((_, idx) => idx !== i));
  }

  function validateExpenses(): string | null {
    for (const [i, e] of newExpenses.entries()) {
      if (!e.amount || Number(e.amount) <= 0) return `Despesa ${i + 1}: valor obrigatório.`;
      if (e.category === "outra") {
        if (!e.description?.trim()) return `Despesa ${i + 1} (Outras): descrição obrigatória.`;
        if (!e.payment_method_id) return `Despesa ${i + 1} (Outras): forma de pagamento obrigatória.`;
        if (!e.paid_by) return `Despesa ${i + 1} (Outras): "Pago por" obrigatório.`;
        if (!e.vehicle_id) return `Despesa ${i + 1} (Outras): veículo obrigatório.`;
        if (!e.cost_center_id) return `Despesa ${i + 1} (Outras): centro de custo obrigatório.`;
      }
    }
    return null;
  }

  const finalize = useMutation({
    mutationFn: async () => {
      if (!confirm) throw new Error("Confirme a finalização");
      const err = validateExpenses();
      if (err) throw new Error(err);

      // 1) Upsert closing
      const closingPayload: any = {
        service_order_id: service.id,
        start_time: form.start_time || null,
        end_time: form.end_time || nowIso(),
        km_initial: Number(form.km_initial) || null,
        km_final: Number(form.km_final) || null,
        sale_value: saleValue,
        amount_received: Number(form.amount_received) || 0,
        payment_method_id: form.payment_method_id || null,
        received_by: form.received_by || null,
        balance_pending: balancePending,
        incidents: form.incidents || null,
        notes: form.notes || null,
        closed_at: nowIso(),
        closed_by: user!.id,
      };
      const { error: cErr } = await supabase.from("service_closings")
        .upsert(closingPayload, { onConflict: "service_order_id" });
      if (cErr) throw cErr;

      // 2) Update OC status/receipts
      await supabase.from("service_orders").update({
        status: "finalizado",
        amount_received: closingPayload.amount_received,
        amount_pending: closingPayload.balance_pending,
      }).eq("id", service.id);

      // 3) Cash movement for received amount (idempotent — only if not registered yet)
      if (closingPayload.amount_received > 0) {
        const { data: existing } = await supabase.from("cash_movements")
          .select("id").eq("service_order_id", service.id).eq("kind", "entrada").is("service_expense_id", null).limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("cash_movements").insert({
            kind: "entrada",
            amount: closingPayload.amount_received,
            service_order_id: service.id,
            payment_method_id: closingPayload.payment_method_id,
            description: `Recebimento OC ${service.oc_code}`,
            created_by: user!.id,
          });
        }
      }

      // 4) Insert new expenses + matching cash_movements (auto envio ao financeiro)
      for (const e of newExpenses) {
        const { data: ins, error: eErr } = await supabase.from("service_expenses").insert({
          service_order_id: service.id,
          category: e.category,
          description: e.description || null,
          amount: Number(e.amount),
          payment_method_id: e.payment_method_id || null,
          paid_by: e.paid_by || user!.id,
          vehicle_id: e.vehicle_id || service.vehicle_id || null,
          cost_center_id: e.cost_center_id || null,
        }).select().single();
        if (eErr) throw eErr;
        await supabase.from("cash_movements").insert({
          kind: "saida",
          amount: Number(e.amount),
          service_order_id: service.id,
          service_expense_id: ins.id,
          payment_method_id: e.payment_method_id || null,
          description: `Despesa (${e.category}) OC ${service.oc_code}${e.description ? ` · ${e.description}` : ""}`,
          created_by: user!.id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Serviço finalizado e despesas enviadas ao financeiro");
      setOpen(false); setConfirm(false); setNewExpenses([]);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isClosed = !!closing?.closed_at;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={isClosed ? "outline" : "default"} className="gap-1">
          {isClosed ? <CheckCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {isClosed ? "Ver / editar" : "Finalizar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechamento do serviço · {service.oc_code}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section>
            <h4 className="font-medium mb-2">Horário e quilometragem</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label>Hora de início</Label><Input type="datetime-local" value={toLocalInput(form.start_time)} onChange={(e) => setForm({ ...form, start_time: fromLocalInput(e.target.value) })} /></div>
              <div><Label>Hora de término</Label><Input type="datetime-local" value={toLocalInput(form.end_time)} onChange={(e) => setForm({ ...form, end_time: fromLocalInput(e.target.value) })} /></div>
              <div><Label>Km inicial</Label><Input type="number" value={form.km_initial} onChange={(e) => setForm({ ...form, km_initial: e.target.value })} /></div>
              <div><Label>Km final</Label><Input type="number" value={form.km_final} onChange={(e) => setForm({ ...form, km_final: e.target.value })} /></div>
              <div className="md:col-span-4 text-sm text-muted-foreground">Km percorridos: <b>{kmTraveled}</b></div>
            </div>
          </section>

          <Separator />

          <section>
            <h4 className="font-medium mb-2">Valores e pagamento</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label>Valor do serviço</Label><Input disabled value={saleValue.toFixed(2)} /></div>
              <div><Label>Valor recebido</Label><Input type="number" step="0.01" value={form.amount_received} onChange={(e) => setForm({ ...form, amount_received: e.target.value })} /></div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_method_id || undefined} onValueChange={(v) => setForm({ ...form, payment_method_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{pm.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recebido por</Label>
                <Select value={form.received_by || undefined} onValueChange={(v) => setForm({ ...form, received_by: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{profilesList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-4 text-sm">Saldo pendente: <b className={balancePending > 0 ? "text-rose-600" : "text-emerald-600"}>€ {balancePending.toFixed(2)}</b></div>
            </div>
          </section>

          <Separator />

          <section>
            <h4 className="font-medium mb-2">Observações e ocorrências</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div><Label>Ocorrências</Label><Textarea value={form.incidents} onChange={(e) => setForm({ ...form, incidents: e.target.value })} placeholder="Atrasos, incidentes, alterações…" /></div>
            </div>
          </section>

          <Separator />

          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Despesas do dia</h4>
              <Button size="sm" variant="outline" onClick={addExpense} className="gap-1"><Plus className="w-4 h-4" /> Nova despesa</Button>
            </div>

            {existingExpenses.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-1">Já registadas (enviadas ao financeiro)</div>
                <div className="space-y-1 text-sm">
                  {existingExpenses.map((e: any) => (
                    <div key={e.id} className="flex justify-between border rounded px-2 py-1">
                      <span className="capitalize">{e.category}{e.description ? ` · ${e.description}` : ""}</span>
                      <span className="font-medium">€ {Number(e.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {newExpenses.map((e, i) => {
              const isOutra = e.category === "outra";
              return (
                <div key={i} className="border rounded-lg p-3 mb-2 space-y-3 bg-muted/30">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label>Categoria</Label>
                      <Select value={e.category} onValueChange={(v) => updateExpense(i, { category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Valor (€) *</Label><Input type="number" step="0.01" value={e.amount} onChange={(ev) => updateExpense(i, { amount: ev.target.value })} /></div>
                    <div className="md:col-span-2 flex items-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => removeExpense(i)} className="ml-auto"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>

                  {isOutra && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                      <div className="md:col-span-3"><Label>Descrição *</Label><Input value={e.description} onChange={(ev) => updateExpense(i, { description: ev.target.value })} /></div>
                      <div>
                        <Label>Forma de pagamento *</Label>
                        <Select value={e.payment_method_id || undefined} onValueChange={(v) => updateExpense(i, { payment_method_id: v })}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{pm.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Pago por *</Label>
                        <Select value={e.paid_by || undefined} onValueChange={(v) => updateExpense(i, { paid_by: v })}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{profilesList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Veículo *</Label>
                        <Select value={e.vehicle_id || undefined} onValueChange={(v) => updateExpense(i, { vehicle_id: v })}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{vehiclesList.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand ?? ""} {v.model ?? ""}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label>Centro de custo *</Label>
                        <Select value={e.cost_center_id || undefined} onValueChange={(v) => updateExpense(i, { cost_center_id: v })}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{cc.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {newExpenses.length === 0 && existingExpenses.length === 0 && (
              <div className="text-xs text-muted-foreground">Nenhuma despesa. Clique em "Nova despesa" para adicionar (estacionamento, abastecimento, portagens, lavagem, outras).</div>
            )}
          </section>

          <label className="flex items-center gap-2 text-sm pt-2 border-t">
            <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} />
            Confirmo a finalização deste serviço. Despesas serão automaticamente enviadas ao módulo financeiro.
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className="gradient-gold text-gold-foreground" disabled={!confirm || finalize.isPending} onClick={() => finalize.mutate()}>
            {isClosed ? "Guardar alterações" : "Finalizar serviço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string {
  if (!v) return "";
  return new Date(v).toISOString();
}
