import { createFileRoute } from "@tanstack/react-router";
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
import { Pencil, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/conta-corrente")({ component: ContaCorrente });

const emptyMv = {
  movement_date: new Date().toISOString().slice(0, 10),
  kind: "entrada", amount: 0, description: "",
  bank_account_id: "", payment_method_id: "",
};

function ContaCorrente() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<string>("all");
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyMv);

  const { data: accounts = [] } = useQuery({ queryKey: ["ba-list"], queryFn: async () => (await (supabase.from("bank_accounts" as any).select("*") as any)).data ?? [] });
  const { data: pm = [] } = useQuery({ queryKey: ["pm-list"], queryFn: async () => (await (supabase.from("payment_methods" as any).select("*").eq("active", true) as any)).data ?? [] });
  const { data: mv = [] } = useQuery({
    queryKey: ["cm", accountId, year, month, kindFilter],
    queryFn: async () => {
      const start = month === "all" ? `${year}-01-01` : `${year}-${String(month).padStart(2,"0")}-01`;
      const endD = month === "all" ? new Date(year + 1, 0, 1) : new Date(year, Number(month), 1);
      const end = endD.toISOString().slice(0,10);
      let q = (supabase.from("cash_movements" as any).select("*") as any)
        .gte("movement_date", start).lt("movement_date", end)
        .order("movement_date", { ascending: false }).limit(1000);
      if (accountId !== "all") q = q.eq("bank_account_id", accountId);
      if (kindFilter !== "all") q = q.eq("kind", kindFilter);
      return (await q).data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, amount: Number(form.amount || 0) };
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      if (editing?.id) {
        const { error } = await supabase.from("cash_movements").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user!.id;
        const { error } = await supabase.from("cash_movements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Movimento atualizado" : "Movimento criado");
      qc.invalidateQueries({ queryKey: ["cm"] });
      setOpen(false); setEditing(null); setForm(emptyMv);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cash_movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Movimento removido"); qc.invalidateQueries({ queryKey: ["cm"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setForm(emptyMv); setOpen(true); }
  function openEdit(m: any) {
    setEditing(m);
    setForm({
      movement_date: m.movement_date ?? "", kind: m.kind ?? "entrada",
      amount: m.amount ?? 0, description: m.description ?? "",
      bank_account_id: m.bank_account_id ?? "", payment_method_id: m.payment_method_id ?? "",
    });
    setOpen(true);
  }

  const inflow = mv.filter((m: any) => m.kind === "entrada").reduce((a: number, m: any) => a + Number(m.amount), 0);
  const outflow = mv.filter((m: any) => m.kind === "saida").reduce((a: number, m: any) => a + Number(m.amount), 0);
  const opening = accountId === "all"
    ? accounts.reduce((a: number, x: any) => a + Number(x.opening_balance || 0), 0)
    : Number(accounts.find((x: any) => x.id === accountId)?.opening_balance || 0);
  const balance = opening + inflow - outflow;

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader title="Conta Corrente" description="Extrato de entradas e saídas." actions={
        <div className="flex flex-wrap gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano todo</SelectItem>
              {months.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Entradas e saídas</SelectItem>
              <SelectItem value="entrada">Só entradas</SelectItem>
              <SelectItem value="saida">Só saídas</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gradient-gold text-gold-foreground" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo movimento</Button>
        </div>
      } />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Saldo inicial</div><div className="text-xl font-bold">€ {opening.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Entradas</div><div className="text-xl font-bold text-emerald-600">€ {inflow.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Saídas</div><div className="text-xl font-bold text-destructive">€ {outflow.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Saldo atual</div><div className={`text-xl font-bold ${balance < 0 ? "text-destructive" : "text-emerald-600"}`}>€ {balance.toFixed(2)}</div></Card>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead>
            <TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {mv.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell>{m.movement_date}</TableCell>
                <TableCell><Badge variant={m.kind === "entrada" ? "default" : "destructive"}>{m.kind}</Badge></TableCell>
                <TableCell>{m.description ?? "—"}</TableCell>
                <TableCell className={`text-right font-medium ${m.kind === "entrada" ? "text-emerald-600" : "text-destructive"}`}>
                  {m.kind === "entrada" ? "+" : "−"} € {Number(m.amount).toFixed(2)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este movimento?")) del.mutate(m.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {mv.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem movimentos.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar movimento" : "Novo movimento"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} /></div>
            <div><Label>Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Conta bancária</Label>
              <Select value={form.bank_account_id} onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Forma de pagamento</Label>
              <Select value={form.payment_method_id} onValueChange={(v) => setForm({ ...form, payment_method_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{pm.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={!form.amount}>{editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
