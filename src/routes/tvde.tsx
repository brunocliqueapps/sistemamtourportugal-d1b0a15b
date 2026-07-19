import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/tvde")({ component: TVDE });

function TVDE() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: shift } = useQuery({
    queryKey: ["tvde-shift"],
    queryFn: async () => (await supabase.from("tvde_shifts").select("*, vehicles(plate)").eq("operation_type","tvde").is("closed_at", null).order("created_at",{ascending:false}).limit(1).maybeSingle()).data,
  });
  const { data: earnings = [] } = useQuery({
    queryKey: ["earnings", shift?.id], enabled: !!shift,
    queryFn: async () => (await supabase.from("tvde_earnings").select("*").eq("tvde_shift_id", shift!.id)).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["tvde-exp", shift?.id], enabled: !!shift,
    queryFn: async () => (await supabase.from("service_expenses").select("*").eq("tvde_shift_id", shift!.id)).data ?? [],
  });
  const { data: pmethods = [] } = useQuery({ queryKey: ["pm2"], queryFn: async () => (await supabase.from("payment_methods").select("id,name")).data ?? [] });

  const [earn, setEarn] = useState<any>({ platform: "uber", gross: 0, tips: 0, bonus: 0, commissions: 0, other_deductions: 0 });
  const [exp, setExp] = useState<any>({ category: "abastecimento", description: "", amount: 0, payment_method_id: "" });
  const [close, setClose] = useState<any>({ km_final: 0 });

  const addEarn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tvde_earnings").insert({ ...earn, tvde_shift_id: shift!.id,
        gross: Number(earn.gross), tips: Number(earn.tips), bonus: Number(earn.bonus),
        commissions: Number(earn.commissions), other_deductions: Number(earn.other_deductions) });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ganho registado"); qc.invalidateQueries(); setEarn({ platform: "uber", gross: 0, tips: 0, bonus: 0, commissions: 0, other_deductions: 0 }); },
  });

  const addExp = useMutation({
    mutationFn: async () => {
      if (exp.category === "outra" && !exp.description) throw new Error("Descrição obrigatória.");
      const { data, error } = await supabase.from("service_expenses").insert({
        tvde_shift_id: shift!.id, category: exp.category, description: exp.description,
        amount: Number(exp.amount), payment_method_id: exp.payment_method_id || null,
        paid_by: user!.id, vehicle_id: shift!.vehicle_id,
      }).select().single();
      if (error) throw error;
      await supabase.from("cash_movements").insert({
        kind: "saida", amount: Number(exp.amount),
        tvde_shift_id: shift!.id, service_expense_id: data.id, payment_method_id: exp.payment_method_id || null,
        description: `TVDE ${exp.category}${exp.description ? " · " + exp.description : ""}`,
        created_by: user!.id,
      });
    },
    onSuccess: () => { toast.success("Despesa registada"); qc.invalidateQueries(); setExp({ category: "abastecimento", description: "", amount: 0, payment_method_id: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const closeShift = useMutation({
    mutationFn: async () => {
      const net = earnings.reduce((a: number, e: any) => a + Number(e.net || 0), 0);
      const { error } = await supabase.from("tvde_shifts").update({
        end_time: new Date().toISOString(), km_final: Number(close.km_final) || null,
        closed_at: new Date().toISOString(), closed_by: user!.id,
      }).eq("id", shift!.id);
      if (error) throw error;
      if (net > 0) {
        await supabase.from("cash_movements").insert({
          kind: "entrada", amount: net, tvde_shift_id: shift!.id,
          description: `Fechamento TVDE (líquido plataformas)`, created_by: user!.id,
        });
      }
    },
    onSuccess: () => { toast.success("Turno TVDE fechado"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!shift) return <div className="p-8 space-y-4"><PageHeader title="TVDE" description="Sem turno TVDE em curso." /><Card className="p-6 text-muted-foreground">Abre um turno em <b>Turnos Motorista</b> com tipo "Plataforma TVDE".</Card></div>;

  const totalGross = earnings.reduce((a: number, e: any) => a + Number(e.gross||0) + Number(e.tips||0) + Number(e.bonus||0), 0);
  const totalCom = earnings.reduce((a: number, e: any) => a + Number(e.commissions||0) + Number(e.other_deductions||0), 0);
  const totalExp = expenses.reduce((a: number, e: any) => a + Number(e.amount||0), 0);
  const netPlat = totalGross - totalCom;
  const finalNet = netPlat - totalExp;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Fechamento TVDE" description={`Turno ${shift.shift_date} · ${shift.vehicles?.plate}`} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Bruto plataformas</div><div className="text-xl font-bold">€ {totalGross.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Comissões</div><div className="text-xl font-bold text-destructive">€ {totalCom.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Despesas</div><div className="text-xl font-bold text-destructive">€ {totalExp.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Líquido final</div><div className="text-xl font-bold text-emerald-600">€ {finalNet.toFixed(2)}</div></Card>
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Ganhos por plataforma</h3>
        <div className="grid gap-3 md:grid-cols-6">
          <div><Label>Plataforma</Label>
            <Select value={earn.platform} onValueChange={(v) => setEarn({ ...earn, platform: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="uber">Uber</SelectItem><SelectItem value="bolt">Bolt</SelectItem><SelectItem value="outra">Outra</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Bruto</Label><Input type="number" step="0.01" value={earn.gross} onChange={(e) => setEarn({ ...earn, gross: e.target.value })} /></div>
          <div><Label>Gorjetas</Label><Input type="number" step="0.01" value={earn.tips} onChange={(e) => setEarn({ ...earn, tips: e.target.value })} /></div>
          <div><Label>Bónus</Label><Input type="number" step="0.01" value={earn.bonus} onChange={(e) => setEarn({ ...earn, bonus: e.target.value })} /></div>
          <div><Label>Comissões</Label><Input type="number" step="0.01" value={earn.commissions} onChange={(e) => setEarn({ ...earn, commissions: e.target.value })} /></div>
          <div><Label>Outras deduções</Label><Input type="number" step="0.01" value={earn.other_deductions} onChange={(e) => setEarn({ ...earn, other_deductions: e.target.value })} /></div>
        </div>
        <Button variant="outline" onClick={() => addEarn.mutate()}>+ Adicionar ganho</Button>
        <Table>
          <TableHeader><TableRow><TableHead>Plataforma</TableHead><TableHead>Bruto</TableHead><TableHead>Gorjetas</TableHead><TableHead>Comissões</TableHead><TableHead className="text-right">Líquido</TableHead></TableRow></TableHeader>
          <TableBody>{earnings.map((e: any) => (
            <TableRow key={e.id}><TableCell><Badge>{e.platform}</Badge></TableCell><TableCell>€ {Number(e.gross).toFixed(2)}</TableCell><TableCell>€ {Number(e.tips).toFixed(2)}</TableCell><TableCell>€ {Number(e.commissions).toFixed(2)}</TableCell><TableCell className="text-right">€ {Number(e.net).toFixed(2)}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Despesas do turno</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <div><Label>Categoria</Label>
            <Select value={exp.category} onValueChange={(v) => setExp({ ...exp, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["abastecimento","estacionamento","portagem","lavagem","outra"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Fechar turno</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div><Label>Km final</Label><Input type="number" value={close.km_final} onChange={(e) => setClose({ ...close, km_final: e.target.value })} /></div>
        </div>
        <Button variant="destructive" onClick={() => closeShift.mutate()}>Fechar turno TVDE</Button>
      </Card>
    </div>
  );
}
