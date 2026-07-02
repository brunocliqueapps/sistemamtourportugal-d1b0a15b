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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/financeiro")({ component: Financeiro });

function Financeiro() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [type, setType] = useState<"entrada" | "saida">("entrada");
  const [form, setForm] = useState({ establishment: "", invoice_number: "", amount: 0 });
  const [file, setFile] = useState<File | null>(null);

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => (await supabase.from("transactions").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (type === "saida" && !file) throw new Error("Fatura é obrigatória em saídas.");
      let photo_url: string | null = null;
      if (file) {
        const path = `${user!.id}/${Date.now()}-${file.name}`;
        const up = await supabase.storage.from("invoices").upload(path, file);
        if (up.error) throw up.error;
        photo_url = supabase.storage.from("invoices").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("transactions").insert({ ...form, type, photo_url, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registada");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setForm({ establishment: "", invoice_number: "", amount: 0 });
      setFile(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalIn = txs.filter((t: any) => t.type === "entrada").reduce((a: number, t: any) => a + Number(t.amount), 0);
  const totalOut = txs.filter((t: any) => t.type === "saida").reduce((a: number, t: any) => a + Number(t.amount), 0);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Financeiro" description="Entradas e saídas registadas na operação." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><div className="text-sm text-muted-foreground">Entradas</div><div className="text-2xl font-bold text-emerald-600">€ {totalIn.toFixed(2)}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Saídas</div><div className="text-2xl font-bold text-destructive">€ {totalOut.toFixed(2)}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Saldo</div><div className="text-2xl font-bold">€ {(totalIn - totalOut).toFixed(2)}</div></Card>
      </div>

      <Card className="p-6">
        <Tabs value={type} onValueChange={(v) => setType(v as any)}>
          <TabsList><TabsTrigger value="entrada">Entrada</TabsTrigger><TabsTrigger value="saida">Saída</TabsTrigger></TabsList>
          <TabsContent value={type} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Estabelecimento</Label><Input value={form.establishment} onChange={(e) => setForm({ ...form, establishment: e.target.value })} /></div>
              <div><Label>Nº Fatura</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
              <div><Label>Valor (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div><Label>Foto da Fatura {type === "saida" && <span className="text-destructive">*</span>}</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            </div>
            <Button className="gradient-gold text-gold-foreground" onClick={() => create.mutate()} disabled={form.amount <= 0}>Registar {type === "entrada" ? "Entrada" : "Saída"}</Button>
          </TabsContent>
        </Tabs>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Estabelecimento</TableHead><TableHead>Fatura</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Foto</TableHead></TableRow></TableHeader>
          <TableBody>
            {txs.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell><Badge variant={t.type === "entrada" ? "default" : "destructive"}>{t.type}</Badge></TableCell>
                <TableCell>{t.establishment}</TableCell>
                <TableCell>{t.invoice_number}</TableCell>
                <TableCell className="text-right">€ {Number(t.amount).toFixed(2)}</TableCell>
                <TableCell>{t.photo_url && <a href={t.photo_url} target="_blank" className="text-primary underline text-sm">Ver</a>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
