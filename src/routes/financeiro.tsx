import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, FileDown } from "lucide-react";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/financeiro")({ component: Financeiro });

function Financeiro() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState<"entrada" | "saida">("entrada");
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<string>("all"); // 'all' | '1'..'12'
  const [f, setF] = useState<any>({
    doc_type: "fatura", invoice_number: "", series: "", issue_date: new Date().toISOString().slice(0,10),
    due_date: "", entity_name: "", entity_nif: "", description: "",
    value_ex_vat: 0, vat_rate_id: "", vat_amount: 0, vat_deductible: 0, vat_non_deductible: 0,
    deduction_pct: 100, total: 0, cost_center_id: "", payment_method_id: "", bank_account_id: "",
    status: "pendente", paid_amount: 0, observations: "",
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["invoices", year, month],
    queryFn: async () => {
      const start = month === "all" ? `${year}-01-01` : `${year}-${String(month).padStart(2,"0")}-01`;
      const endD = month === "all"
        ? new Date(year + 1, 0, 1)
        : new Date(year, Number(month), 1);
      const end = endD.toISOString().slice(0,10);
      return (await supabase.from("invoices").select("*").gte("issue_date", start).lt("issue_date", end).order("issue_date", { ascending: false })).data ?? [];
    },
  });
  const { data: vat = [] } = useQuery({ queryKey: ["vat"], queryFn: async () => (await supabase.from("vat_rates").select("*").eq("active", true)).data ?? [] });
  const { data: cc = [] } = useQuery({ queryKey: ["cc"], queryFn: async () => (await supabase.from("cost_centers").select("*").eq("active", true)).data ?? [] });
  const { data: pm = [] } = useQuery({ queryKey: ["pmf"], queryFn: async () => (await supabase.from("payment_methods").select("*").eq("active", true)).data ?? [] });
  const { data: ba = [] } = useQuery({ queryKey: ["ba"], queryFn: async () => (await supabase.from("bank_accounts").select("*").eq("active", true)).data ?? [] });

  function recalc(patch: Partial<any>) {
    const next = { ...f, ...patch };
    const rate = vat.find((v: any) => v.id === next.vat_rate_id);
    const base = Number(next.value_ex_vat || 0);
    const vatAmt = rate ? base * Number(rate.rate) / 100 : 0;
    const dedPct = Number(next.deduction_pct || 0);
    next.vat_amount = +vatAmt.toFixed(2);
    next.vat_deductible = +((vatAmt * dedPct) / 100).toFixed(2);
    next.vat_non_deductible = +(vatAmt - next.vat_deductible).toFixed(2);
    next.total = +(base + vatAmt).toFixed(2);
    setF(next);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (kind === "saida" && !file && !f.photo_url) toast.warning("Recomenda-se anexar a fatura em saídas.");
      let photo_url = f.photo_url ?? null;
      if (file) {
        const path = `${user!.id}/${Date.now()}-${file.name}`;
        const up = await supabase.storage.from("invoices").upload(path, file);
        if (up.error) throw up.error;
        photo_url = supabase.storage.from("invoices").getPublicUrl(path).data.publicUrl;
      }
      const payload: any = { ...f, kind, photo_url, created_by: user!.id };
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      const { data, error } = await supabase.from("invoices").insert(payload).select().single();
      if (error) throw error;
      // Se pago, criar movimento
      if (payload.status === "pago" && Number(payload.paid_amount || payload.total) > 0) {
        await supabase.from("cash_movements").insert({
          kind, amount: Number(payload.paid_amount || payload.total),
          invoice_id: data.id, payment_method_id: payload.payment_method_id,
          bank_account_id: payload.bank_account_id,
          description: `${kind === "entrada" ? "Recebimento" : "Pagamento"} ${data.code}`,
          created_by: user!.id,
        });
      }
    },
    onSuccess: () => { toast.success("Fatura registada"); qc.invalidateQueries({ queryKey: ["invoices"] }); setOpen(false); setFile(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalIn = rows.filter((r: any) => r.kind === "entrada").reduce((a: number, r: any) => a + Number(r.total || 0), 0);
  const totalOut = rows.filter((r: any) => r.kind === "saida").reduce((a: number, r: any) => a + Number(r.total || 0), 0);
  const filtered = rows.filter((r: any) => r.kind === kind);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Financeiro" description="Faturas e movimentos com controlo fiscal (IVA dedutível / não dedutível)." actions={
        <Button className="gradient-gold text-gold-foreground" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova fatura</Button>
      } />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><div className="text-sm text-muted-foreground">Total Entradas</div><div className="text-2xl font-bold text-emerald-600">€ {totalIn.toFixed(2)}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Total Saídas</div><div className="text-2xl font-bold text-destructive">€ {totalOut.toFixed(2)}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Resultado</div><div className="text-2xl font-bold">€ {(totalIn - totalOut).toFixed(2)}</div></Card>
      </div>

      <Tabs value={kind} onValueChange={(v) => setKind(v as any)}>
        <TabsList><TabsTrigger value="entrada">Entradas</TabsTrigger><TabsTrigger value="saida">Saídas</TabsTrigger></TabsList>
        <TabsContent value={kind}>
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Nº Fatura</TableHead><TableHead>Data</TableHead>
                <TableHead>Entidade</TableHead><TableHead>NIF</TableHead>
                <TableHead className="text-right">Base</TableHead><TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead><TableHead>Estado</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{r.series ? `${r.series}/` : ""}{r.invoice_number ?? "—"}</TableCell>
                    <TableCell>{r.issue_date}</TableCell>
                    <TableCell>{r.entity_name ?? "—"}</TableCell>
                    <TableCell>{r.entity_nif ?? "—"}</TableCell>
                    <TableCell className="text-right">€ {Number(r.value_ex_vat).toFixed(2)}</TableCell>
                    <TableCell className="text-right">€ {Number(r.vat_amount).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">€ {Number(r.total).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={r.status === "pago" ? "default" : r.status === "vencido" ? "destructive" : "outline"}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sem faturas.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova fatura · {kind === "entrada" ? "Entrada" : "Saída"}</DialogTitle></DialogHeader>
          <Tabs value={kind} onValueChange={(v) => setKind(v as any)} className="mb-2">
            <TabsList><TabsTrigger value="entrada">Entrada</TabsTrigger><TabsTrigger value="saida">Saída</TabsTrigger></TabsList>
          </Tabs>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Tipo doc</Label>
              <Select value={f.doc_type} onValueChange={(v) => setF({ ...f, doc_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["fatura","fatura_recibo","recibo","nota_credito","nota_debito","fatura_simplificada"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Série</Label><Input value={f.series} onChange={(e) => setF({ ...f, series: e.target.value })} /></div>
            <div><Label>Nº Fatura</Label><Input value={f.invoice_number} onChange={(e) => setF({ ...f, invoice_number: e.target.value })} /></div>
            <div><Label>Emissão</Label><Input type="date" value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} /></div>
            <div><Label>Vencimento</Label><Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
            <div><Label>Estado</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["pendente","pago","parcialmente_pago","vencido","cancelado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>{kind === "entrada" ? "Cliente" : "Fornecedor"}</Label><Input value={f.entity_name} onChange={(e) => setF({ ...f, entity_name: e.target.value })} /></div>
            <div><Label>NIF</Label><Input value={f.entity_nif} onChange={(e) => setF({ ...f, entity_nif: e.target.value })} /></div>
            <div className="col-span-3"><Label>Descrição</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>

            <div><Label>Valor s/IVA (€)</Label><Input type="number" step="0.01" value={f.value_ex_vat} onChange={(e) => recalc({ value_ex_vat: e.target.value })} /></div>
            <div><Label>Taxa IVA</Label>
              <Select value={f.vat_rate_id} onValueChange={(v) => recalc({ vat_rate_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{vat.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>% Dedução</Label><Input type="number" step="0.01" value={f.deduction_pct} onChange={(e) => recalc({ deduction_pct: e.target.value })} /></div>
            <div><Label>IVA total (€)</Label><Input disabled value={f.vat_amount} /></div>
            <div><Label>IVA dedutível</Label><Input disabled value={f.vat_deductible} /></div>
            <div><Label>IVA não dedutível</Label><Input disabled value={f.vat_non_deductible} /></div>
            <div><Label>Total (€)</Label><Input disabled value={f.total} className="font-semibold" /></div>

            <div><Label>Centro de custo</Label>
              <Select value={f.cost_center_id} onValueChange={(v) => setF({ ...f, cost_center_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{cc.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Forma pagamento</Label>
              <Select value={f.payment_method_id} onValueChange={(v) => setF({ ...f, payment_method_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{pm.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Conta bancária</Label>
              <Select value={f.bank_account_id} onValueChange={(v) => setF({ ...f, bank_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{ba.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="col-span-3"><Label>Foto da fatura</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <div className="col-span-3"><Label>Observações</Label><Input value={f.observations} onChange={(e) => setF({ ...f, observations: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={!f.value_ex_vat}>Registar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
