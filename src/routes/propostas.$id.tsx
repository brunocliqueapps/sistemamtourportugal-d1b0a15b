import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/propostas/$id")({ component: PropostaDetail });

function PropostaDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: proposal } = useQuery({
    queryKey: ["proposal", id],
    queryFn: async () => (await supabase.from("proposals").select("*, leads(name,email)").eq("id", id).maybeSingle()).data,
  });
  const { data: days = [] } = useQuery({
    queryKey: ["proposal-days", id],
    queryFn: async () => (await supabase.from("proposal_days").select("*").eq("proposal_id", id).order("day_number")).data ?? [],
  });
  const { data: pays = [] } = useQuery({
    queryKey: ["payments", id],
    queryFn: async () => (await supabase.from("payments").select("*").eq("proposal_id", id).order("payment_date", { ascending: false })).data ?? [],
  });

  const [dayDesc, setDayDesc] = useState("");
  const addDay = useMutation({
    mutationFn: async () => {
      const next = (days.length ? Math.max(...days.map((d: any) => d.day_number)) : 0) + 1;
      const { error } = await supabase.from("proposal_days").insert({ proposal_id: id, day_number: next, description: dayDesc });
      if (error) throw error;
    },
    onSuccess: () => { setDayDesc(""); qc.invalidateQueries({ queryKey: ["proposal-days", id] }); },
  });
  const removeDay = useMutation({
    mutationFn: async (dayId: string) => { await supabase.from("proposal_days").delete().eq("id", dayId); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal-days", id] }),
  });

  const [pay, setPay] = useState({ payment_method: "transferencia", amount: 0, payment_date: new Date().toISOString().slice(0, 10) });
  const addPay = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({ ...pay, proposal_id: id, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento registado");
      qc.invalidateQueries({ queryKey: ["payments", id] });
      setPay({ ...pay, amount: 0 });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const total = Number(proposal?.total_value || 0);
  const recebido = pays.reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
  const pendente = total - recebido;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title={proposal ? `Proposta ${proposal.service_number}` : "Proposta"}
        description={proposal ? `${proposal.leads?.name} · ${proposal.service_type}` : ""}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Roteiro por dia</h3>
          <div className="flex gap-2 mb-4">
            <Textarea placeholder="Descrição do próximo dia…" value={dayDesc} onChange={(e) => setDayDesc(e.target.value)} rows={2} />
            <Button onClick={() => addDay.mutate()} disabled={!dayDesc || addDay.isPending}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-2">
            {days.map((d: any) => (
              <div key={d.id} className="flex gap-3 items-start p-3 rounded-md bg-muted">
                <div className="h-8 w-8 shrink-0 rounded-full gradient-gold text-gold-foreground flex items-center justify-center text-sm font-bold">{d.day_number}</div>
                <p className="text-sm flex-1">{d.description}</p>
                <Button variant="ghost" size="sm" onClick={() => removeDay.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {days.length === 0 && <p className="text-sm text-muted-foreground">Sem dias cadastrados.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Pagamentos</h3>
          <div className="grid grid-cols-3 gap-2 text-sm text-center mb-4">
            <div className="p-2 rounded bg-muted"><div className="text-xs text-muted-foreground">Total</div><div className="font-bold">€ {total.toFixed(2)}</div></div>
            <div className="p-2 rounded bg-emerald-500/10"><div className="text-xs text-muted-foreground">Recebido</div><div className="font-bold text-emerald-700 dark:text-emerald-300">€ {recebido.toFixed(2)}</div></div>
            <div className="p-2 rounded bg-destructive/10"><div className="text-xs text-muted-foreground">Pendente</div><div className="font-bold text-destructive">€ {pendente.toFixed(2)}</div></div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Forma</Label>
                <Select value={pay.payment_method} onValueChange={(v) => setPay({ ...pay, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="mbway">MB Way</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor (€)</Label><Input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Data</Label><Input type="date" value={pay.payment_date} onChange={(e) => setPay({ ...pay, payment_date: e.target.value })} /></div>
            <Button className="w-full" onClick={() => addPay.mutate()} disabled={pay.amount <= 0}>Registar Pagamento</Button>
          </div>
          <Table className="mt-4">
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>
              {pays.map((p: any) => (
                <TableRow key={p.id}><TableCell>{p.payment_date}</TableCell><TableCell>{p.payment_method}</TableCell><TableCell className="text-right">€ {Number(p.amount).toFixed(2)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
