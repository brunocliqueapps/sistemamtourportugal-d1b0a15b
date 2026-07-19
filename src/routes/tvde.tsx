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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Plus, Eye, Pencil } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";

export const Route = createFileRoute("/tvde")({ component: TVDE });

const EMPTY_EARN = { platform: "uber", gross: 0, tips: 0, bonus: 0, commissions: 0, other_deductions: 0, notes: "" };
const EMPTY_EXP = { category: "abastecimento", description: "", amount: 0, payment_method_id: "", paid_by_driver: false };

function TVDE() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: shift } = useQuery({
    queryKey: ["tvde-shift"],
    queryFn: async () =>
      (await supabase.from("tvde_shifts")
        .select("*, vehicles(plate), drivers(full_name)")
        .eq("operation_type", "tvde").is("closed_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle()).data,
  });

  const { data: earnings = [] } = useQuery({
    queryKey: ["tvde-earnings", shift?.id], enabled: !!shift,
    queryFn: async () => (await supabase.from("tvde_earnings").select("*").eq("tvde_shift_id", shift!.id)).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["tvde-exp", shift?.id], enabled: !!shift,
    queryFn: async () => (await supabase.from("service_expenses").select("*").eq("tvde_shift_id", shift!.id)).data ?? [],
  });
  const { data: pmethods = [] } = useQuery({
    queryKey: ["pm-tvde"],
    queryFn: async () => (await supabase.from("payment_methods").select("id,name")).data ?? [],
  });

  const [earn, setEarn] = useState<any>(EMPTY_EARN);
  const [exp, setExp] = useState<any>(EMPTY_EXP);
  const [close, setClose] = useState<any>({ km_final: "", driver_pct: 50, notes: "" });
  const [editEarn, setEditEarn] = useState<any | null>(null);
  const [editExp, setEditExp] = useState<any | null>(null);

  const addEarn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tvde_earnings").insert({
        tvde_shift_id: shift!.id, platform: earn.platform,
        gross: Number(earn.gross) || 0, tips: Number(earn.tips) || 0, bonus: Number(earn.bonus) || 0,
        commissions: Number(earn.commissions) || 0, other_deductions: Number(earn.other_deductions) || 0,
        notes: earn.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ganho registado"); qc.invalidateQueries(); setEarn(EMPTY_EARN); },
    onError: (e: any) => toast.error(e.message),
  });

  const delEarn = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tvde_earnings").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries(),
  });

  const addExp = useMutation({
    mutationFn: async () => {
      if (exp.category === "outra" && !exp.description) throw new Error("Descrição obrigatória para 'Outras despesas'.");
      if (!Number(exp.amount)) throw new Error("Valor obrigatório.");
      const { data, error } = await supabase.from("service_expenses").insert({
        tvde_shift_id: shift!.id, category: exp.category, description: exp.description || null,
        amount: Number(exp.amount), payment_method_id: exp.payment_method_id || null,
        paid_by: user!.id, vehicle_id: shift!.vehicle_id,
      }).select().single();
      if (error) throw error;
      // Só lança no financeiro se paga pela empresa (não pelo motorista)
      if (!exp.paid_by_driver) {
        await supabase.from("cash_movements").insert({
          kind: "saida", amount: Number(exp.amount),
          tvde_shift_id: shift!.id, service_expense_id: data.id,
          payment_method_id: exp.payment_method_id || null,
          description: `TVDE · ${exp.category}${exp.description ? " · " + exp.description : ""}`,
          created_by: user!.id,
        });
      }
    },
    onSuccess: () => { toast.success("Despesa registada"); qc.invalidateQueries(); setExp(EMPTY_EXP); },
    onError: (e: any) => toast.error(e.message),
  });

  const delExp = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("cash_movements").delete().eq("service_expense_id", id);
      const { error } = await supabase.from("service_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const saveEarn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tvde_earnings").update({
        platform: editEarn.platform,
        gross: Number(editEarn.gross) || 0, tips: Number(editEarn.tips) || 0, bonus: Number(editEarn.bonus) || 0,
        commissions: Number(editEarn.commissions) || 0, other_deductions: Number(editEarn.other_deductions) || 0,
        notes: editEarn.notes || null,
      }).eq("id", editEarn.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ganho atualizado"); setEditEarn(null); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveExp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_expenses").update({
        category: editExp.category,
        description: editExp.description || null,
        amount: Number(editExp.amount) || 0,
        payment_method_id: editExp.payment_method_id || null,
      }).eq("id", editExp.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Despesa atualizada"); setEditExp(null); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });


  const closeShift = useMutation({
    mutationFn: async () => {
      const kmFinal = close.km_final ? Number(close.km_final) : null;
      const closedAt = new Date().toISOString();
      const { error } = await supabase.from("tvde_shifts").update({
        end_time: closedAt,
        km_final: kmFinal,
        closed_at: closedAt,
        closed_by: user!.id,
        notes: [shift!.notes, close.notes && `Acerto: ${close.notes}`, `Motorista %: ${close.driver_pct}%`].filter(Boolean).join(" · "),
      }).eq("id", shift!.id);
      if (error) throw error;

      // Lançamentos automáticos no financeiro (Conta Corrente):
      // 1) Entrada: líquido de plataformas (bruto - comissões - retenções)
      if (netPlat > 0) {
        const { data: existing } = await supabase.from("cash_movements")
          .select("id").eq("tvde_shift_id", shift!.id).eq("kind", "entrada").is("service_expense_id", null).limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("cash_movements").insert({
            kind: "entrada", amount: Number(netPlat.toFixed(2)),
            tvde_shift_id: shift!.id,
            description: `TVDE · líquido plataformas (${shift!.shift_date})`,
            created_by: user!.id,
          });
        }
      }
      // 2) Saída: comissão do motorista
      if (devidoMotorista > 0) {
        await supabase.from("cash_movements").insert({
          kind: "saida", amount: Number(devidoMotorista.toFixed(2)),
          tvde_shift_id: shift!.id,
          description: `TVDE · comissão motorista ${driverPct}% (${shift!.shift_date})`,
          created_by: user!.id,
        });
      }
    },
    onSuccess: () => { toast.success("Turno TVDE fechado e lançado no financeiro"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });


  if (!shift) {
    return (
      <div className="p-4 sm:p-6 md:p-8 space-y-6">
        <PageHeader
          title="TVDE"
          description="Sem operação TVDE em curso. Abra uma nova operação para começar a registar."
          actions={<NewOperationButton />}
        />
        <TvdeHistory />
      </div>
    );
  }

  // ---------- Totais ----------
  const totBy = (p: string) => earnings.filter((e: any) => e.platform === p).reduce((a: number, e: any) => a + Number(e.gross || 0), 0);
  const uber = totBy("uber"), bolt = totBy("bolt"), outrasPlat = totBy("outra");
  const tips = earnings.reduce((a: number, e: any) => a + Number(e.tips || 0), 0);
  const bonus = earnings.reduce((a: number, e: any) => a + Number(e.bonus || 0), 0);
  const commissions = earnings.reduce((a: number, e: any) => a + Number(e.commissions || 0), 0);
  const otherDed = earnings.reduce((a: number, e: any) => a + Number(e.other_deductions || 0), 0);

  const grossPlat = uber + bolt + outrasPlat + tips + bonus;
  const netPlat = grossPlat - commissions - otherDed;

  const expByCat = (c: string) => expenses.filter((e: any) => e.category === c).reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
  const fuel = expByCat("abastecimento"), parking = expByCat("estacionamento"), tolls = expByCat("portagem"), wash = expByCat("lavagem"), others = expByCat("outra");
  const totalExp = fuel + parking + tolls + wash + others;

  const receitaBruta = grossPlat;
  const receitaLiquida = netPlat - totalExp;

  const driverPct = Number(close.driver_pct) || 0;
  const empresaPct = 100 - driverPct;
  const devidoMotorista = (receitaLiquida * driverPct) / 100;
  const devidoEmpresa = (receitaLiquida * empresaPct) / 100;
  const acerto = devidoMotorista; // empresa recebe plataformas e paga % ao motorista


  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title="Fechamento TVDE"
        description={`${shift.shift_date} · ${shift.drivers?.full_name ?? "—"} · ${shift.vehicles?.plate ?? "—"}`}
        actions={<NewOperationButton />}
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Receita bruta</div><div className="text-xl font-bold">€ {receitaBruta.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Comissões + retenções</div><div className="text-xl font-bold text-destructive">€ {(commissions + otherDed).toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Despesas</div><div className="text-xl font-bold text-destructive">€ {totalExp.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Receita líquida</div><div className={`text-xl font-bold ${receitaLiquida >= 0 ? "text-emerald-600" : "text-destructive"}`}>€ {receitaLiquida.toFixed(2)}</div></Card>
      </div>

      {/* -------------------- PLATAFORMAS -------------------- */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Ganhos por plataforma</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div><Label>Plataforma</Label>
            <Select value={earn.platform} onValueChange={(v) => setEarn({ ...earn, platform: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="uber">Uber</SelectItem>
                <SelectItem value="bolt">Bolt</SelectItem>
                <SelectItem value="outra">Outra</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Bruto (€)</Label><Input type="number" step="0.01" value={earn.gross} onChange={(e) => setEarn({ ...earn, gross: e.target.value })} /></div>
          <div><Label>Gorjetas</Label><Input type="number" step="0.01" value={earn.tips} onChange={(e) => setEarn({ ...earn, tips: e.target.value })} /></div>
          <div><Label>Bónus / ajustes</Label><Input type="number" step="0.01" value={earn.bonus} onChange={(e) => setEarn({ ...earn, bonus: e.target.value })} /></div>
          <div><Label>Comissões</Label><Input type="number" step="0.01" value={earn.commissions} onChange={(e) => setEarn({ ...earn, commissions: e.target.value })} /></div>
          <div><Label>Outras retenções</Label><Input type="number" step="0.01" value={earn.other_deductions} onChange={(e) => setEarn({ ...earn, other_deductions: e.target.value })} /></div>
          <div className="flex items-end"><Button className="w-full" onClick={() => addEarn.mutate()}>+ Adicionar</Button></div>
        </div>

        <Table>
          <TableHeader><TableRow>
            <TableHead>Plataforma</TableHead><TableHead>Bruto</TableHead><TableHead>Gorjetas</TableHead>
            <TableHead>Bónus</TableHead><TableHead>Comissões</TableHead><TableHead>Retenções</TableHead>
            <TableHead className="text-right">Líquido</TableHead><TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {earnings.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell><Badge>{e.platform}</Badge></TableCell>
                <TableCell>€ {Number(e.gross).toFixed(2)}</TableCell>
                <TableCell>€ {Number(e.tips).toFixed(2)}</TableCell>
                <TableCell>€ {Number(e.bonus).toFixed(2)}</TableCell>
                <TableCell>€ {Number(e.commissions).toFixed(2)}</TableCell>
                <TableCell>€ {Number(e.other_deductions).toFixed(2)}</TableCell>
                <TableCell className="text-right font-semibold">€ {Number(e.net).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" title="Editar" onClick={() => setEditEarn({ ...e })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => delEarn.mutate(e.id)}>×</Button>
                </TableCell>
              </TableRow>
            ))}
            {earnings.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem ganhos registados.</TableCell></TableRow>}
          </TableBody>
        </Table>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t text-sm">
          <div>Uber: <b>€ {uber.toFixed(2)}</b></div>
          <div>Bolt: <b>€ {bolt.toFixed(2)}</b></div>
          <div>Outras: <b>€ {outrasPlat.toFixed(2)}</b></div>
          <div>Líquido plataformas: <b className="text-emerald-600">€ {netPlat.toFixed(2)}</b></div>
        </div>
      </Card>

      {/* -------------------- DESPESAS -------------------- */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Despesas da operação TVDE</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div><Label>Categoria</Label>
            <Select value={exp.category} onValueChange={(v) => setExp({ ...exp, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abastecimento">Abastecimento / carregamento</SelectItem>
                <SelectItem value="estacionamento">Estacionamento</SelectItem>
                <SelectItem value="portagem">Portagens</SelectItem>
                <SelectItem value="lavagem">Lavagem</SelectItem>
                <SelectItem value="outra">Outras despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Descrição {exp.category === "outra" && <span className="text-destructive">*</span>}</Label>
            <Input value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} />
          </div>
          <div><Label>Valor (€) *</Label><Input type="number" step="0.01" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} /></div>
          <div><Label>Forma de pagamento</Label>
            <Select value={exp.payment_method_id} onValueChange={(v) => setExp({ ...exp, payment_method_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{pmethods.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Pago por</Label>
            <Select value={exp.paid_by_driver ? "driver" : "company"} onValueChange={(v) => setExp({ ...exp, paid_by_driver: v === "driver" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Empresa</SelectItem>
                <SelectItem value="driver">Motorista</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="outline" onClick={() => addExp.mutate()} disabled={!exp.amount}>+ Registar despesa</Button>

        <Table>
          <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-24 text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {expenses.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                <TableCell>{e.description ?? "—"}</TableCell>
                <TableCell className="text-right">€ {Number(e.amount).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" title="Editar" onClick={() => setEditExp({ ...e })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => delExp.mutate(e.id)}>×</Button>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem despesas.</TableCell></TableRow>}
          </TableBody>
        </Table>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 pt-2 border-t text-sm">
          <div>Combustível: <b>€ {fuel.toFixed(2)}</b></div>
          <div>Estacionamento: <b>€ {parking.toFixed(2)}</b></div>
          <div>Portagens: <b>€ {tolls.toFixed(2)}</b></div>
          <div>Lavagem: <b>€ {wash.toFixed(2)}</b></div>
          <div>Outras: <b>€ {others.toFixed(2)}</b></div>
        </div>
      </Card>

      {/* -------------------- FECHAMENTO -------------------- */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Resumo do turno</h3>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-1">
            <div className="font-semibold text-emerald-600">Receitas</div>
            <Row label="Uber" v={uber} />
            <Row label="Bolt" v={bolt} />
            <Row label="Outras plataformas" v={outrasPlat} />
            <Row label="Gorjetas" v={tips} />
            <Row label="Bónus / ajustes" v={bonus} />
            <Row label="Receita bruta" v={receitaBruta} bold />
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-destructive">Deduções</div>
            <Row label="Comissões plataformas" v={-commissions} />
            <Row label="Outras retenções" v={-otherDed} />
            <Row label="Abastecimento / energia" v={-fuel} />
            <Row label="Estacionamento" v={-parking} />
            <Row label="Portagens" v={-tolls} />
            <Row label="Lavagem" v={-wash} />
            <Row label="Outras despesas" v={-others} />
            <Row label="Receita líquida" v={receitaLiquida} bold />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Acerto motorista × empresa</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Km final</Label><Input type="number" value={close.km_final} onChange={(e) => setClose({ ...close, km_final: e.target.value })} /></div>
          <div><Label>% Motorista</Label><Input type="number" value={close.driver_pct} onChange={(e) => setClose({ ...close, driver_pct: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Observações do acerto</Label><Input value={close.notes} onChange={(e) => setClose({ ...close, notes: e.target.value })} /></div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 text-sm border-t pt-3">
          <div className="space-y-1">
            <Row label={`Devido ao motorista (${driverPct}%)`} v={devidoMotorista} bold />
          </div>
          <div className="space-y-1">
            <Row label={`Devido à empresa (${empresaPct}%)`} v={devidoEmpresa} bold />
          </div>
        </div>

        <div className="pt-3">
          <Button variant="destructive" onClick={() => closeShift.mutate()}>Fechar turno TVDE</Button>
        </div>
      </Card>

      {/* Edit dialogs */}
      <Dialog open={!!editEarn} onOpenChange={(o) => !o && setEditEarn(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar ganho</DialogTitle></DialogHeader>
          {editEarn && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Plataforma</Label>
                <Select value={editEarn.platform} onValueChange={(v) => setEditEarn({ ...editEarn, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uber">Uber</SelectItem>
                    <SelectItem value="bolt">Bolt</SelectItem>
                    <SelectItem value="outra">Outra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Bruto (€)</Label><Input type="number" step="0.01" value={editEarn.gross ?? 0} onChange={(e) => setEditEarn({ ...editEarn, gross: e.target.value })} /></div>
              <div><Label>Gorjetas</Label><Input type="number" step="0.01" value={editEarn.tips ?? 0} onChange={(e) => setEditEarn({ ...editEarn, tips: e.target.value })} /></div>
              <div><Label>Bónus</Label><Input type="number" step="0.01" value={editEarn.bonus ?? 0} onChange={(e) => setEditEarn({ ...editEarn, bonus: e.target.value })} /></div>
              <div><Label>Comissões</Label><Input type="number" step="0.01" value={editEarn.commissions ?? 0} onChange={(e) => setEditEarn({ ...editEarn, commissions: e.target.value })} /></div>
              <div><Label>Outras retenções</Label><Input type="number" step="0.01" value={editEarn.other_deductions ?? 0} onChange={(e) => setEditEarn({ ...editEarn, other_deductions: e.target.value })} /></div>
              <div className="col-span-2"><Label>Notas</Label><Input value={editEarn.notes ?? ""} onChange={(e) => setEditEarn({ ...editEarn, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEarn(null)}>Cancelar</Button>
            <Button onClick={() => saveEarn.mutate()} disabled={saveEarn.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editExp} onOpenChange={(o) => !o && setEditExp(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar despesa</DialogTitle></DialogHeader>
          {editExp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={editExp.category} onValueChange={(v) => setEditExp({ ...editExp, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abastecimento">Abastecimento</SelectItem>
                    <SelectItem value="estacionamento">Estacionamento</SelectItem>
                    <SelectItem value="portagem">Portagens</SelectItem>
                    <SelectItem value="lavagem">Lavagem</SelectItem>
                    <SelectItem value="outra">Outras despesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor (€)</Label><Input type="number" step="0.01" value={editExp.amount ?? 0} onChange={(e) => setEditExp({ ...editExp, amount: e.target.value })} /></div>
              <div className="col-span-2"><Label>Descrição</Label><Input value={editExp.description ?? ""} onChange={(e) => setEditExp({ ...editExp, description: e.target.value })} /></div>
              <div className="col-span-2"><Label>Forma de pagamento</Label>
                <Select value={editExp.payment_method_id ?? ""} onValueChange={(v) => setEditExp({ ...editExp, payment_method_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{pmethods.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExp(null)}>Cancelar</Button>
            <Button onClick={() => saveExp.mutate()} disabled={saveExp.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TvdeHistory />
    </div>
  );
}


function NewOperationButton() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    driver_id: "", vehicle_id: "",
    shift_date: new Date().toISOString().slice(0, 10),
    km_initial: "", notes: "",
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-op"], enabled: open,
    queryFn: async () => (await supabase.from("drivers").select("id,full_name").order("full_name")).data ?? [],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["veh-op-tvde"], enabled: open,
    queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model").order("plate")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.vehicle_id) throw new Error("Veículo obrigatório.");
      const { error } = await supabase.from("tvde_shifts").insert({
        driver_id: form.driver_id || null,
        vehicle_id: form.vehicle_id,
        operation_type: "tvde",
        shift_date: form.shift_date,
        start_time: new Date().toISOString(),
        km_initial: form.km_initial ? Number(form.km_initial) : null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Operação TVDE aberta");
      qc.invalidateQueries();
      setOpen(false);
      setForm({ driver_id: "", vehicle_id: "", shift_date: new Date().toISOString().slice(0, 10), km_initial: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className="gradient-gold text-gold-foreground" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" /> Nova Operação
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova operação TVDE</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Data</Label><Input type="date" value={form.shift_date} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} /></div>
          <div><Label>Km inicial</Label><Input type="number" value={form.km_initial} onChange={(e) => setForm({ ...form, km_initial: e.target.value })} /></div>
          <div className="col-span-2"><Label>Motorista</Label>
            <Select value={form.driver_id} onValueChange={(v) => setForm({ ...form, driver_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Veículo *</Label>
            <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand ?? ""} {v.model ?? ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Notas</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className="gradient-gold text-gold-foreground" onClick={() => create.mutate()} disabled={create.isPending}>Abrir operação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TvdeHistory() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [driverId, setDriverId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-hist"],
    queryFn: async () => (await supabase.from("drivers").select("id,full_name").order("full_name")).data ?? [],
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["tvde-shifts-hist", from, to, driverId, statusFilter],
    queryFn: async () => {
      let q = supabase.from("tvde_shifts")
        .select("*, drivers(full_name), vehicles(plate), tvde_earnings(gross,tips,bonus,commissions,other_deductions)")
        .eq("operation_type", "tvde")
        .gte("shift_date", from).lte("shift_date", to)
        .order("shift_date", { ascending: false });
      if (driverId !== "all") q = q.eq("driver_id", driverId);
      if (statusFilter === "open") q = q.is("closed_at", null);
      if (statusFilter === "closed") q = q.not("closed_at", "is", null);
      return (await q).data ?? [];
    },
  });

  return (
    <Card className="p-5 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-semibold">Histórico de operações TVDE</h3>
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Motorista" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motoristas</SelectItem>
              {drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="closed">Fechadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ShiftHistoryTable shifts={shifts} />
    </Card>
  );
}

function ShiftHistoryTable({ shifts }: { shifts: any[] }) {
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-hist"], enabled: !!editing,
    queryFn: async () => (await supabase.from("drivers").select("id,full_name").order("full_name")).data ?? [],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["veh-hist"], enabled: !!editing,
    queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model").order("plate")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload: any = {
        shift_date: editing.shift_date,
        driver_id: editing.driver_id || null,
        vehicle_id: editing.vehicle_id || null,
        km_initial: editing.km_initial === "" || editing.km_initial == null ? null : Number(editing.km_initial),
        km_final: editing.km_final === "" || editing.km_final == null ? null : Number(editing.km_final),
        notes: editing.notes || null,
      };
      if (editing._reopen) payload.closed_at = null;
      const { error } = await supabase.from("tvde_shifts").update(payload).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Operação atualizada");
      setEditing(null);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Data</TableHead><TableHead>Motorista</TableHead><TableHead>Veículo</TableHead>
          <TableHead className="text-right">Bruto plat.</TableHead>
          <TableHead className="text-right">Líquido plat.</TableHead>
          <TableHead className="text-right">Comissão Motorista</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="w-24 text-right">Ações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {shifts.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sem operações no período.</TableCell></TableRow>}
          {shifts.map((s: any) => {
            const gross = (s.tvde_earnings ?? []).reduce((a: number, e: any) => a + Number(e.gross || 0) + Number(e.tips || 0) + Number(e.bonus || 0), 0);
            const net = (s.tvde_earnings ?? []).reduce((a: number, e: any) => a + Number(e.gross || 0) + Number(e.tips || 0) + Number(e.bonus || 0) - Number(e.commissions || 0) - Number(e.other_deductions || 0), 0);
            const pctMatch = /Motorista %:\s*(\d+(?:\.\d+)?)/.exec(s.notes ?? "");
            const driverPct = pctMatch ? Number(pctMatch[1]) : 0;
            const driverCommission = (net * driverPct) / 100;
            return (
              <TableRow key={s.id}>
                <TableCell>{s.shift_date}</TableCell>
                <TableCell>{s.drivers?.full_name ?? "—"}</TableCell>
                <TableCell>{s.vehicles?.plate ?? "—"}</TableCell>
                <TableCell className="text-right">€ {gross.toFixed(2)}</TableCell>
                <TableCell className="text-right font-semibold">€ {net.toFixed(2)}</TableCell>
                <TableCell className="text-right">{driverPct ? `€ ${driverCommission.toFixed(2)} (${driverPct}%)` : "—"}</TableCell>
                <TableCell>{s.closed_at ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Fechada</Badge> : <Badge variant="outline">Em aberto</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(s)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Editar" onClick={() => setEditing({ ...s, _reopen: false })}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Operação TVDE — detalhes completos"
        record={viewing}
        fields={[
          { key: "shift_date", label: "Data" },
          { key: "operation_type", label: "Tipo" },
          { key: "drivers", label: "Motorista", format: (v) => v?.full_name ?? "—" },
          { key: "vehicles", label: "Veículo", format: (v) => v?.plate ?? "—" },
          { key: "start_time", label: "Início", format: (v) => v ? new Date(v).toLocaleString("pt-PT") : "—" },
          { key: "end_time", label: "Fim", format: (v) => v ? new Date(v).toLocaleString("pt-PT") : "—" },
          { key: "closed_at", label: "Fechada em", format: (v) => v ? new Date(v).toLocaleString("pt-PT") : "—" },
          { key: "km_initial", label: "Km inicial" },
          { key: "km_final", label: "Km final" },
          { key: "km_final", label: "Km percorridos", format: (_v, r) => (r?.km_initial != null && r?.km_final != null) ? Math.max(0, Number(r.km_final) - Number(r.km_initial)) : "—" },
          { key: "tvde_earnings", label: "Bruto plataformas", format: (arr) => `€ ${(arr ?? []).reduce((a: number, e: any) => a + Number(e.gross || 0) + Number(e.tips || 0) + Number(e.bonus || 0), 0).toFixed(2)}` },
          { key: "tvde_earnings", label: "Comissões plataformas", format: (arr) => `€ ${(arr ?? []).reduce((a: number, e: any) => a + Number(e.commissions || 0), 0).toFixed(2)}` },
          { key: "tvde_earnings", label: "Outras retenções", format: (arr) => `€ ${(arr ?? []).reduce((a: number, e: any) => a + Number(e.other_deductions || 0), 0).toFixed(2)}` },
          { key: "tvde_earnings", label: "Líquido plataformas", format: (arr) => `€ ${(arr ?? []).reduce((a: number, e: any) => a + Number(e.gross || 0) + Number(e.tips || 0) + Number(e.bonus || 0) - Number(e.commissions || 0) - Number(e.other_deductions || 0), 0).toFixed(2)}` },
          { key: "notes", label: "% Motorista", format: (v) => { const m = /Motorista %:\s*(\d+(?:\.\d+)?)/.exec(v ?? ""); return m ? `${m[1]}%` : "—"; } },
          { key: "notes", label: "Comissão devida ao motorista", format: (v, r) => {
              const m = /Motorista %:\s*(\d+(?:\.\d+)?)/.exec(v ?? ""); const pct = m ? Number(m[1]) : 0;
              const net = (r?.tvde_earnings ?? []).reduce((a: number, e: any) => a + Number(e.gross || 0) + Number(e.tips || 0) + Number(e.bonus || 0) - Number(e.commissions || 0) - Number(e.other_deductions || 0), 0);
              return `€ ${((net * pct) / 100).toFixed(2)}`;
            } },
          { key: "notes", label: "Notas" },
        ]}
      />


      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar operação TVDE</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={editing.shift_date ?? ""} onChange={(e) => setEditing({ ...editing, shift_date: e.target.value })} /></div>
              <div className="flex items-end">
                {editing.closed_at && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editing._reopen} onChange={(e) => setEditing({ ...editing, _reopen: e.target.checked })} />
                    Reabrir operação
                  </label>
                )}
              </div>
              <div className="col-span-2"><Label>Motorista</Label>
                <Select value={editing.driver_id ?? ""} onValueChange={(v) => setEditing({ ...editing, driver_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Veículo</Label>
                <Select value={editing.vehicle_id ?? ""} onValueChange={(v) => setEditing({ ...editing, vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand ?? ""} {v.model ?? ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Km inicial</Label><Input type="number" value={editing.km_initial ?? ""} onChange={(e) => setEditing({ ...editing, km_initial: e.target.value })} /></div>
              <div><Label>Km final</Label><Input type="number" value={editing.km_final ?? ""} onChange={(e) => setEditing({ ...editing, km_final: e.target.value })} /></div>
              <div className="col-span-2"><Label>Notas</Label>
                <textarea className="w-full min-h-24 rounded-md border border-input bg-background p-2 text-sm" value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function Row({ label, v, bold }: { label: string; v: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold border-t pt-1 mt-1" : ""}`}>
      <span>{label}</span>
      <span className={v < 0 ? "text-destructive" : ""}>€ {v.toFixed(2)}</span>
    </div>
  );
}
