import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { shortCode } from "@/lib/codes";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/oc/$id")({ component: OCDetail });

const STATES = ["agendado","confirmado","motorista_designado","em_deslocacao","cliente_a_bordo","em_execucao","finalizado","cancelado","nao_realizado"];

function OCDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: so } = useQuery({
    queryKey: ["so", id],
    queryFn: async () => (await (supabase.from("service_orders" as any).select("*, clients(name,phone), vehicles(id,plate,brand,model)").eq("id", id).maybeSingle() as any)).data,
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles-mini2"], queryFn: async () => (await (supabase.from("vehicles" as any).select("id,plate,brand,model").eq("active", true) as any)).data ?? [] });
  const { data: pmethods = [] } = useQuery({ queryKey: ["pm"], queryFn: async () => (await (supabase.from("payment_methods" as any).select("id,name").eq("active", true) as any)).data ?? [] });
  const { data: closing } = useQuery({ queryKey: ["closing", id], queryFn: async () => (await (supabase.from("service_closings" as any).select("*").eq("service_order_id", id).maybeSingle() as any)).data });
  const { data: expenses = [] } = useQuery({ queryKey: ["exp", id], queryFn: async () => (await (supabase.from("service_expenses" as any).select("*").eq("service_order_id", id) as any)).data ?? [] });

  const [close, setClose] = useState<any>({ km_initial: 0, km_final: 0, amount_received: 0, payment_method_id: "", balance_pending: 0, incidents: "" });
  const [exp, setExp] = useState<any>({ category: "estacionamento", description: "", amount: 0, payment_method_id: "" });

  useEffect(() => {
    if (closing) setClose({ ...close, ...closing });
    else if (so) setClose((s: any) => ({ ...s, sale_value: so.sale_value, amount_received: so.amount_received }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing, so]);

  const patchSo = useMutation({
    mutationFn: async (patch: any) => { const { error } = await supabase.from("service_orders").update(patch).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["so", id] }),
  });

  const finalize = useMutation({
    mutationFn: async () => {
      const payload = {
        service_order_id: id,
        km_initial: Number(close.km_initial) || null,
        km_final: Number(close.km_final) || null,
        sale_value: Number(so?.sale_value || 0),
        amount_received: Number(close.amount_received) || 0,
        payment_method_id: close.payment_method_id || null,
        balance_pending: Number(so?.sale_value || 0) - Number(close.amount_received || 0),
        incidents: close.incidents,
        end_time: new Date().toISOString(),
        closed_by: user!.id,
      };
      const { error } = await supabase.from("service_closings" as any).upsert(payload as any, { onConflict: "service_order_id" });
      if (error) throw error;
      await supabase.from("service_orders" as any).update({ status: "finalizado", amount_received: payload.amount_received, amount_pending: payload.balance_pending } as any).eq("id", id);
      // criar movimento de caixa (entrada)
      if (payload.amount_received > 0) {
        await supabase.from("cash_movements" as any).insert({
          kind: "entrada", amount: payload.amount_received,
          service_order_id: id, payment_method_id: payload.payment_method_id,
          description: `Recebimento OS ${shortCode((so as any)?.oc_code)}`, created_by: user!.id,
        } as any);
      }
    },
    onSuccess: () => { toast.success("Serviço finalizado e enviado ao financeiro"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addExp = useMutation({
    mutationFn: async () => {
      if (exp.category === "outra" && !exp.description) throw new Error("Descrição obrigatória para outras despesas.");
      const { data, error } = await (supabase.from("service_expenses" as any).insert({
        service_order_id: id, category: exp.category, description: exp.description,
        amount: Number(exp.amount), payment_method_id: exp.payment_method_id || null,
        paid_by: user!.id, vehicle_id: (so as any)?.vehicle_id,
      } as any).select().single() as any);
      if (error) throw error;
      await supabase.from("cash_movements").insert({
        kind: "saida", amount: Number(exp.amount),
        service_order_id: id, service_expense_id: data.id, payment_method_id: exp.payment_method_id || null,
        description: `Despesa ${exp.category}${exp.description ? " · " + exp.description : ""} · OS ${shortCode(so?.oc_code)}`,
        created_by: user!.id,
      });
    },
    onSuccess: () => { toast.success("Despesa registada"); qc.invalidateQueries(); setExp({ category: "estacionamento", description: "", amount: 0, payment_method_id: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!so) return <div className="p-8 text-muted-foreground">A carregar…</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader title={`OS ${shortCode(so.oc_code)}`} description={`Voucher ${shortCode(so.voucher_code)} · Serviço ${so.service_code}`} actions={
        <Link to="/oc" className="text-sm text-primary underline">← Voltar</Link>
      } />

      <Card className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{so.status}</Badge>
          <Select value={so.status} onValueChange={(v) => patchSo.mutate({ status: v })}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><div className="text-xs text-muted-foreground">Cliente</div><div>{so.clients?.name}</div><div className="text-xs">{so.clients?.phone}</div></div>
          <div><div className="text-xs text-muted-foreground">Data / Hora</div><div>{so.service_date} {so.start_time?.slice(0,5)}</div></div>
          <div><div className="text-xs text-muted-foreground">Passageiros</div><div>{so.passengers ?? "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Origem</div><div>{so.origin}</div></div>
          <div><div className="text-xs text-muted-foreground">Destino</div><div>{so.destination}</div></div>
          <div><div className="text-xs text-muted-foreground">Valor</div><div className="font-semibold">€ {Number(so.sale_value||0).toFixed(2)}</div></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>Veículo</Label>
            <Select value={so.vehicle_id ?? ""} onValueChange={(v) => patchSo.mutate({ vehicle_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Fechamento do serviço</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Km inicial</Label><Input type="number" value={close.km_initial ?? 0} onChange={(e) => setClose({ ...close, km_initial: e.target.value })} /></div>
          <div><Label>Km final</Label><Input type="number" value={close.km_final ?? 0} onChange={(e) => setClose({ ...close, km_final: e.target.value })} /></div>
          <div><Label>Valor recebido (€)</Label><Input type="number" step="0.01" value={close.amount_received ?? 0} onChange={(e) => setClose({ ...close, amount_received: e.target.value })} /></div>
          <div><Label>Forma pagamento</Label>
            <Select value={close.payment_method_id ?? ""} onValueChange={(v) => setClose({ ...close, payment_method_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{pmethods.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4"><Label>Ocorrências</Label><Input value={close.incidents ?? ""} onChange={(e) => setClose({ ...close, incidents: e.target.value })} /></div>
        </div>
        <Button className="gradient-gold text-gold-foreground" onClick={() => finalize.mutate()}>Finalizar Serviço</Button>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Despesas do serviço</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div><Label>Categoria</Label>
            <Select value={exp.category} onValueChange={(v) => setExp({ ...exp, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["estacionamento","abastecimento","portagem","lavagem","outra"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label>Descrição {exp.category === "outra" && <span className="text-destructive">*</span>}</Label><Input value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} /></div>
          <div><Label>Valor (€)</Label><Input type="number" step="0.01" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} /></div>
          <div><Label>Pagamento</Label>
            <Select value={exp.payment_method_id} onValueChange={(v) => setExp({ ...exp, payment_method_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{pmethods.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="outline" onClick={() => addExp.mutate()} disabled={!exp.amount}>+ Registar despesa</Button>

        <Table>
          <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {expenses.map((e: any) => (
              <TableRow key={e.id}><TableCell>{e.category}</TableCell><TableCell>{e.description ?? "—"}</TableCell><TableCell className="text-right">€ {Number(e.amount).toFixed(2)}</TableCell></TableRow>
            ))}
            {expenses.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem despesas.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
