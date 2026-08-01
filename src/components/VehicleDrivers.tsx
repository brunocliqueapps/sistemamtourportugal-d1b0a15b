import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export function VehicleDrivers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", "mini"],
    queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model,usage_type,owner_company").order("plate")).data ?? [],
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers", "mini"],
    queryFn: async () => (await supabase.from("drivers").select("id,full_name").order("full_name")).data ?? [],
  });
  const { data: links = [] } = useQuery({
    queryKey: ["vehicle_drivers"],
    queryFn: async () =>
      (await supabase.from("vehicle_drivers").select("*, vehicles(plate,brand,model,usage_type,owner_company), drivers(full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const resetForm = () => { setEditId(null); setVehicleId(""); setDriverId(""); setIsPrimary(false); };

  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = (l: any) => {
    setEditId(l.id); setVehicleId(l.vehicle_id); setDriverId(l.driver_id); setIsPrimary(!!l.is_primary); setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!vehicleId || !driverId) throw new Error("Escolhe veículo e motorista");
      if (editId) {
        const { error } = await supabase.from("vehicle_drivers").update({ vehicle_id: vehicleId, driver_id: driverId, is_primary: isPrimary }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicle_drivers").insert({ vehicle_id: vehicleId, driver_id: driverId, is_primary: isPrimary });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Atribuição atualizada" : "Motorista atribuído");
      qc.invalidateQueries({ queryKey: ["vehicle_drivers"] });
      setOpen(false); resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_drivers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atribuição removida"); qc.invalidateQueries({ queryKey: ["vehicle_drivers"] }); },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Motoristas atribuídos</h2>
        <Button onClick={openNew} className="gradient-gold text-gold-foreground">
          <UserPlus className="h-4 w-4 mr-1" /> Atribuir motorista
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Veículo</TableHead><TableHead>Utilização</TableHead>
            <TableHead>Motorista</TableHead>
            <TableHead>Principal</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {links.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono">{l.vehicles?.plate} · {l.vehicles?.brand} {l.vehicles?.model}</TableCell>
                <TableCell><Badge variant="outline">{l.vehicles?.usage_type === "aluguel" ? "Aluguel" : "Uso próprio"}</Badge></TableCell>
                <TableCell>{l.drivers?.full_name ?? "—"}</TableCell>
                <TableCell>{l.is_primary ? "Sim" : "Não"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover atribuição?")) del.mutate(l.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {links.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem motoristas atribuídos.</TableCell></TableRow>}

          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar atribuição" : "Atribuir motorista ao veículo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Veículo</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motorista</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger><SelectValue placeholder="Selecionar motorista" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={isPrimary} onCheckedChange={(v) => setIsPrimary(!!v)} />
              <Label>Motorista principal</Label>
            </div>
            <p className="text-xs text-muted-foreground">Podes atribuir mais do que um motorista ao mesmo veículo — repete a operação.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={save.isPending}>Atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
