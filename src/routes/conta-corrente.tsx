import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export const Route = createFileRoute("/conta-corrente")({ component: ContaCorrente });

function ContaCorrente() {
  const [accountId, setAccountId] = useState<string>("all");

  const { data: accounts = [] } = useQuery({ queryKey: ["ba-list"], queryFn: async () => (await supabase.from("bank_accounts").select("*")).data ?? [] });
  const { data: mv = [] } = useQuery({
    queryKey: ["cm", accountId],
    queryFn: async () => {
      let q = supabase.from("cash_movements").select("*").order("movement_date", { ascending: false }).limit(500);
      if (accountId !== "all") q = q.eq("bank_account_id", accountId);
      return (await q).data ?? [];
    },
  });

  const inflow = mv.filter((m: any) => m.kind === "entrada").reduce((a: number, m: any) => a + Number(m.amount), 0);
  const outflow = mv.filter((m: any) => m.kind === "saida").reduce((a: number, m: any) => a + Number(m.amount), 0);
  const opening = accountId === "all"
    ? accounts.reduce((a: number, x: any) => a + Number(x.opening_balance || 0), 0)
    : Number(accounts.find((x: any) => x.id === accountId)?.opening_balance || 0);
  const balance = opening + inflow - outflow;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Conta Corrente" description="Extrato de entradas e saídas." actions={
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      } />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Saldo inicial</div><div className="text-xl font-bold">€ {opening.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Entradas</div><div className="text-xl font-bold text-emerald-600">€ {inflow.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Saídas</div><div className="text-xl font-bold text-destructive">€ {outflow.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Saldo atual</div><div className={`text-xl font-bold ${balance < 0 ? "text-destructive" : "text-emerald-600"}`}>€ {balance.toFixed(2)}</div></Card>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {mv.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell>{m.movement_date}</TableCell>
                <TableCell><Badge variant={m.kind === "entrada" ? "default" : "destructive"}>{m.kind}</Badge></TableCell>
                <TableCell>{m.description ?? "—"}</TableCell>
                <TableCell className={`text-right font-medium ${m.kind === "entrada" ? "text-emerald-600" : "text-destructive"}`}>
                  {m.kind === "entrada" ? "+" : "−"} € {Number(m.amount).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            {mv.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem movimentos.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
