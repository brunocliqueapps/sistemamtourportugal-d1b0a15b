import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/propostas")({ component: Propostas });

function Propostas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ lead_id: "", service_number: "", service_type: "city-tour", total_value: 0 });

  const { data: props = [] } = useQuery({
    queryKey: ["proposals"],
    queryFn: async () => (await supabase.from("proposals").select("*, leads(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-mini"],
    queryFn: async () => (await supabase.from("leads").select("id,name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const service_number = form.service_number || `MTP-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("proposals").insert({ ...form, service_number, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Proposta criada");
      qc.invalidateQueries({ queryKey: ["proposals"] });
      setOpen(false);
      setForm({ lead_id: "", service_number: "", service_type: "city-tour", total_value: 0 });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Propostas" description="Roteiros e serviços vendidos." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-2" />Nova Proposta</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Proposta</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Lead / Cliente</Label>
                <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>{leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nº do Serviço (auto)</Label><Input value={form.service_number} onChange={(e) => setForm({ ...form, service_number: e.target.value })} placeholder="Deixe vazio para gerar" /></div>
              <div>
                <Label>Tipo de serviço</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="city-tour">City Tour</SelectItem>
                    <SelectItem value="pacote">Pacote completo</SelectItem>
                    <SelectItem value="diaria">Diária de motorista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor Total (€)</Label><Input type="number" step="0.01" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: Number(e.target.value) })} /></div>
              <Button className="w-full" onClick={() => create.mutate()} disabled={!form.lead_id || create.isPending}>Salvar Proposta</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº Serviço</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem propostas ainda.</TableCell></TableRow>}
            {props.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-sm">{p.service_number}</TableCell>
                <TableCell>{p.leads?.name}</TableCell>
                <TableCell>{p.service_type}</TableCell>
                <TableCell>€ {Number(p.total_value).toFixed(2)}</TableCell>
                <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Link to="/propostas/$id" params={{ id: p.id }}><Button variant="ghost" size="sm">Abrir</Button></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
