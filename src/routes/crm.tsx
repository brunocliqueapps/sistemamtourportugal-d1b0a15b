import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/crm")({ component: CRM });

const cols: { key: string; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "em_negociacao", label: "Em negociação" },
  { key: "fechado", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
];

function CRM() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", email: "", phone: "", origin: "", status: "novo", notes: "" });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => (await supabase.from("leads").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").insert(form);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lead criado"); qc.invalidateQueries({ queryKey: ["leads"] }); setOpen(false); setForm({ name: "", email: "", phone: "", origin: "", status: "novo", notes: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("leads").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="CRM Comercial" description="Funil de leads e negócios." actions={
        <Button onClick={() => setOpen(true)} className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-1" /> Novo lead</Button>
      } />

      <div className="grid gap-4 md:grid-cols-4">
        {cols.map((c) => (
          <Card key={c.key} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{c.label}</h3>
              <Badge variant="secondary">{leads.filter((l: any) => l.status === c.key).length}</Badge>
            </div>
            <div className="space-y-2">
              {leads.filter((l: any) => l.status === c.key).map((l: any) => (
                <Card key={l.id} className="p-3">
                  <div className="text-xs text-muted-foreground">{l.code}</div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.origin || "Sem origem"}</div>
                  {l.phone && <div className="text-xs">{l.phone}</div>}
                  <Select value={l.status} onValueChange={(v) => update.mutate({ id: l.id, patch: { status: v } })}>
                    <SelectTrigger className="h-7 text-xs mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {cols.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {l.status === "perdido" && (
                    <Input placeholder="Motivo da perda" defaultValue={l.lost_reason ?? ""}
                      onBlur={(e) => update.mutate({ id: l.id, patch: { lost_reason: e.target.value } })}
                      className="h-7 text-xs mt-2" />
                  )}
                </Card>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Origem</Label><Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Instagram, Site, Indicação…" /></div>
            <div><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => create.mutate()} disabled={!form.name}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
