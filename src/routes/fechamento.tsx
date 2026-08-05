import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Lock, Unlock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";

export const Route = createFileRoute("/fechamento")({ component: Fechamento });

function ymFirst(ym: string) { return `${ym}-01`; }
function ymLast(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

function Fechamento() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const qc = useQueryClient();
  const [ym, setYm] = useState(new Date().toISOString().slice(0, 7));
  const [ircRate, setIrcRate] = useState(21);
  const [payAcc, setPayAcc] = useState(0);
  const [withhold, setWithhold] = useState(0);
  const from = ymFirst(ym);
  const to = ymLast(ym);

  const { data } = useQuery({
    queryKey: ["closing-source", ym],
    queryFn: async () => {
      const [invR, cmR, prevR, currR] = await Promise.all([
        supabase.from("invoices").select("kind,total,value_ex_vat,vat_amount,vat_deductible,vat_non_deductible,issue_date")
          .gte("issue_date", from).lte("issue_date", to),
        (supabase.from("cash_movements" as any).select("kind,amount,movement_date").gte("movement_date", from).lte("movement_date", to) as any),
        (supabase.from("monthly_closings" as any).select("*").lt("period", from).order("period", { ascending: false }).limit(1).maybeSingle() as any),
        (supabase.from("monthly_closings" as any).select("*").eq("period", from).maybeSingle() as any),
      ]);
      return { inv: invR.data ?? [], cm: cmR.data ?? [], prev: prevR.data, curr: currR.data };
    },
  });

  const inv = data?.inv ?? [];
  const cm = data?.cm ?? [];
  const revenue = inv.filter((i: any) => i.kind === "entrada").reduce((a: number, i: any) => a + Number(i.total || 0), 0);
  const expenses = inv.filter((i: any) => i.kind === "saida").reduce((a: number, i: any) => a + Number(i.total || 0), 0);
  const vatCharged = inv.filter((i: any) => i.kind === "entrada").reduce((a: number, i: any) => a + Number(i.vat_amount || 0), 0);
  const vatSupported = inv.filter((i: any) => i.kind === "saida").reduce((a: number, i: any) => a + Number(i.vat_amount || 0), 0);
  const vatDeductible = inv.filter((i: any) => i.kind === "saida").reduce((a: number, i: any) => a + Number(i.vat_deductible || 0), 0);
  const vatNonDeductible = inv.filter((i: any) => i.kind === "saida").reduce((a: number, i: any) => a + Number(i.vat_non_deductible || 0), 0);
  const prevCredit = Number(data?.prev?.vat_credit_carry || 0);
  const vatBalance = vatCharged - vatDeductible - prevCredit;
  const vatToPay = Math.max(0, vatBalance);
  const vatCredit = Math.max(0, -vatBalance);

  const cashIn = cm.filter((m: any) => m.kind === "entrada").reduce((a: number, m: any) => a + Number(m.amount), 0);
  const cashOut = cm.filter((m: any) => m.kind === "saida").reduce((a: number, m: any) => a + Number(m.amount), 0);
  const grossProfit = revenue - (expenses - vatSupported);
  const operatingProfit = grossProfit - vatNonDeductible;
  const ircBase = operatingProfit;
  const ircEst = Math.max(0, ircBase * (ircRate / 100));
  const ircBalance = ircEst - payAcc - withhold;

  const current = data?.curr;
  const locked = !!current?.locked;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        period: from, revenue, expenses,
        gross_profit: grossProfit, operating_profit: operatingProfit, net_profit_est: operatingProfit - ircEst,
        vat_charged: vatCharged, vat_supported: vatSupported, vat_deductible: vatDeductible, vat_non_deductible: vatNonDeductible,
        vat_prev_credit: prevCredit, vat_to_pay: vatToPay, vat_credit_carry: vatCredit,
        irc_taxable_base_est: ircBase, irc_estimate: ircEst,
        irc_payments_on_account: payAcc, irc_withholdings: withhold, irc_balance_est: ircBalance,
      };
      const { error } = await supabase.from("monthly_closings" as any).upsert(payload as any, { onConflict: "period" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fechamento gravado"); qc.invalidateQueries({ queryKey: ["closing-source", ym] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const lockIt = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("monthly_closings" as any).update({ locked: true, locked_at: new Date().toISOString(), locked_by: user!.id } as any).eq("period", from);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Período bloqueado"); qc.invalidateQueries({ queryKey: ["closing-source", ym] }); },
  });

  const unlockIt = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("monthly_closings").update({ locked: false, locked_at: null, locked_by: null }).eq("period", from);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Período reaberto"); qc.invalidateQueries({ queryKey: ["closing-source", ym] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader title="Fechamento Mensal" description="Apuramento gerencial de IVA e provisão de IRC. Sujeito a validação do contabilista." actions={
        <Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} className="w-44" />
      } />

      <Card className="p-4 bg-amber-500/10 border-amber-500/30 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          Os valores de IVA e IRC apresentados são <b>estimativas gerenciais</b> para pré-apuramento.
          A declaração periódica de IVA e o Modelo 22 do IRC são obrigações fiscais próprias, cuja validação final cabe ao contabilista certificado.
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Receitas</div><div className="text-xl font-bold text-emerald-600">€ {revenue.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Despesas</div><div className="text-xl font-bold text-destructive">€ {expenses.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Resultado operacional est.</div><div className="text-xl font-bold">€ {operatingProfit.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Fluxo caixa (mês)</div><div className="text-xl font-bold">€ {(cashIn - cashOut).toFixed(2)}</div></Card>
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Apuramento de IVA (pré-apuramento)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>IVA liquidado (vendas): <b>€ {vatCharged.toFixed(2)}</b></div>
          <div>IVA suportado (compras): <b>€ {vatSupported.toFixed(2)}</b></div>
          <div>IVA dedutível: <b>€ {vatDeductible.toFixed(2)}</b></div>
          <div>IVA não dedutível: <b>€ {vatNonDeductible.toFixed(2)}</b></div>
          <div>Crédito período anterior: <b>€ {prevCredit.toFixed(2)}</b></div>
          <div className={vatToPay > 0 ? "text-destructive" : "text-emerald-600"}>
            {vatToPay > 0 ? <>IVA a pagar: <b>€ {vatToPay.toFixed(2)}</b></> : <>Crédito a transportar: <b>€ {vatCredit.toFixed(2)}</b></>}
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Provisão de IRC (estimativa)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Taxa IRC (%)</Label><Input type="number" step="0.01" value={ircRate} onChange={(e) => setIrcRate(Number(e.target.value))} /></div>
          <div><Label>Pagamentos por conta</Label><Input type="number" step="0.01" value={payAcc} onChange={(e) => setPayAcc(Number(e.target.value))} /></div>
          <div><Label>Retenções na fonte</Label><Input type="number" step="0.01" value={withhold} onChange={(e) => setWithhold(Number(e.target.value))} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm mt-2">
          <div>Matéria coletável est.: <b>€ {ircBase.toFixed(2)}</b></div>
          <div>IRC estimado: <b>€ {ircEst.toFixed(2)}</b></div>
          <div className={ircBalance > 0 ? "text-destructive" : "text-emerald-600"}>Saldo IRC est.: <b>€ {ircBalance.toFixed(2)}</b></div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={locked}>Gravar fechamento</Button>
        {current && !locked && <Button variant="destructive" onClick={() => { if (confirm("Bloquear período? Só admin pode reabrir.")) lockIt.mutate(); }}><Lock className="h-4 w-4 mr-1" /> Bloquear período</Button>}
        {locked && <>
          <Badge className="self-center">Período bloqueado</Badge>
          {isAdmin && <Button variant="outline" onClick={() => { if (confirm("Reabrir período bloqueado?")) unlockIt.mutate(); }}><Unlock className="h-4 w-4 mr-1" /> Reabrir período</Button>}
        </>}
      </div>
    </div>
  );
}
