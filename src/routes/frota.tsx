import { createFileRoute } from "@tanstack/react-router";
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
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/frota")({ component: Frota });

function Frota() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ plate: "", brand: "", model: "", year: new Date().getFullYear() });
  const [cost, setCost] = useState({ vehicle_id: "", type: "fixo" as "fixo" | "variavel", name: "", amount: 0, date: new Date().toISOString().slice(0, 10) });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => (await supabase.from("vehicles").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: costs = [] } = useQuery({
    queryKey: ["vehicle-costs"],
    queryFn: async () => (await supabase.from("vehicle_costs").select("*, vehicles(plate)").order("date", { ascending: false })).data ?? [],
  });

  const addV = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vehicles").insert({ ...v, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Veículo criado"); qc.invalidateQueries({ queryKey: ["vehicles"] }); setOpen(false); setV({ plate: "", brand: "", model: "", year: new Date().getFullYear() }); },
    onError: (e: any) => toast.error(e.message),
  });
  const addCost = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("vehicle_costs").insert(cost); if (error) throw error; },
    onSuccess: () => { toast.success("Custo adicionado"); qc.invalidateQueries({ queryKey: ["vehicle-costs"] }); setCost({ ...cost, name: "", amount: 0 }); },
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Gestão de Frota" description="Veículos, custos fixos e variáveis." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-2" />Novo Veículo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Veículo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Matrícula</Label><Input value={v.plate} onChange={(e) => setV({ ...v, plate: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Marca</Label><Input value={v.brand} onChange={(e) => setV({ ...v, brand: e.target.value })} /></div>
                <div><Label>Modelo</Label><Input value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} /></div>
              </div>
              <div><Label>Ano</Label><Input type="number" value={v.year} onChange={(e) => setV({ ...v, year: Number(e.target.value) })} /></div>
              <Button className="w-full" onClick={() => addV.mutate()} disabled={!v.plate}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Matrícula</TableHead><TableHead>Marca/Modelo</TableHead><TableHead>Ano</TableHead></TableRow></TableHeader>
          <TableBody>
            {vehicles.map((x: any) => (
              <TableRow key={x.id}><TableCell className="font-mono">{x.plate}</TableCell><TableCell>{x.brand} {x.model}</TableCell><TableCell>{x.year}</TableCell></TableRow>
            ))}
            {vehicles.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Sem veículos.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Adicionar custo</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <Select value={cost.vehicle_id} onValueChange={(val) => setCost({ ...cost, vehicle_id: val })}>
            <SelectTrigger><SelectValue placeholder="Veículo" /></SelectTrigger>
            <SelectContent>{vehicles.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.plate}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={cost.type} onValueChange={(val) => setCost({ ...cost, type: val as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="fixo">Fixo</SelectItem><SelectItem value="variavel">Variável</SelectItem></SelectContent>
          </Select>
          <Input placeholder="Nome" value={cost.name} onChange={(e) => setCost({ ...cost, name: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Valor €" value={cost.amount} onChange={(e) => setCost({ ...cost, amount: Number(e.target.value) })} />
          <Button onClick={() => addCost.mutate()} disabled={!cost.vehicle_id || !cost.name}>Adicionar</Button>
        </div>
        <Table className="mt-6">
          <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Tipo</TableHead><TableHead>Nome</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {costs.map((c: any) => (
              <TableRow key={c.id}><TableCell>{c.vehicles?.plate}</TableCell><TableCell>{c.type}</TableCell><TableCell>{c.name}</TableCell><TableCell>{c.date}</TableCell><TableCell className="text-right">€ {Number(c.amount).toFixed(2)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
