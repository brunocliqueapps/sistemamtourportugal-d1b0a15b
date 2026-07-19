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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, UserPlus, Archive, ArchiveRestore, Eye } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/crm")({ component: CRM });

const cols: { key: string; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "em_negociacao", label: "Em negociação" },
  { key: "fechado", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
];

const empty = { name: "", email: "", phone: "", origin: "", status: "novo", notes: "", lost_reason: "" };

function CRM() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [showArchivedList, setShowArchivedList] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);


  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => (await supabase.from("leads").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing?.id) {
        const { error } = await supabase.from("leads").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Lead atualizado" : "Lead criado");
      qc.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("leads").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lead removido"); qc.invalidateQueries({ queryKey: ["leads"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("leads").update({ archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.archived ? "Lead arquivado (fora do pipeline)" : "Lead restaurado ao pipeline"); qc.invalidateQueries({ queryKey: ["leads"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const convert = useMutation({
    mutationFn: async (l: any) => {
      const { data: existing } = await supabase.from("clients").select("id").eq("name", l.name).maybeSingle();
      if (existing?.id) throw new Error("Já existe cliente com este nome");
      const { error } = await supabase.from("clients").insert({
        name: l.name, email: l.email || null, phone: l.phone || null, notes: l.notes || null,
      });
      if (error) throw error;
      await supabase.from("leads").update({ status: "fechado" }).eq("id", l.id);
    },
    onSuccess: () => {
      toast.success("Lead convertido em cliente");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["entity", "clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(l: any) {
    setEditing(l);
    setForm({ name: l.name ?? "", email: l.email ?? "", phone: l.phone ?? "", origin: l.origin ?? "", status: l.status ?? "novo", notes: l.notes ?? "", lost_reason: l.lost_reason ?? "" });
    setOpen(true);
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader title="CRM Comercial" description="Funil de leads e negócios." actions={
        <Button onClick={openNew} className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-1" /> Novo lead</Button>
      } />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map((c) => (
          <Card key={c.key} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{c.label}</h3>
              <Badge variant="secondary">{leads.filter((l: any) => l.status === c.key && !l.archived).length}</Badge>
            </div>
            <div className="space-y-2">
              {leads.filter((l: any) => l.status === c.key && !l.archived).map((l: any) => (
                <Card key={l.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{l.code}</div>
                      <div className="font-medium truncate">{l.name}</div>
                      <div className="text-xs text-muted-foreground">{l.origin || "Sem origem"}</div>
                      {l.phone && <div className="text-xs">{l.phone}</div>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Visualizar" onClick={() => setViewing(l)}><Eye className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Converter em cliente" onClick={() => { if (confirm(`Converter "${l.name}" em cliente?`)) convert.mutate(l); }}><UserPlus className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Retirar do pipeline (arquivar)" onClick={() => { if (confirm("Retirar este lead do pipeline? Continuará visível apenas na lista.")) archive.mutate({ id: l.id, archived: true }); }}><Archive className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(l)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { if (confirm("Remover este lead?")) del.mutate(l.id); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
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

      <Card className="mt-6 p-4">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Lista de leads</h3>
            <Badge variant="secondary">{leads.length}</Badge>
            <Badge variant="outline">Arquivados: {leads.filter((l: any) => l.archived).length}</Badge>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showArchivedList} onCheckedChange={setShowArchivedList} />
            Mostrar apenas arquivados
          </label>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.filter((l: any) => showArchivedList ? l.archived : true).map((l: any) => (
                <TableRow key={l.id} className={l.archived ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-xs">{l.code}</TableCell>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-sm">{l.email}</TableCell>
                  <TableCell className="text-sm">{l.phone}</TableCell>
                  <TableCell className="text-sm">{l.origin}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{cols.find((c) => c.key === l.status)?.label ?? l.status}</Badge>
                    {l.archived && <Badge variant="secondary" className="ml-1">Arquivado</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Visualizar" onClick={() => setViewing(l)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Converter em cliente" onClick={() => { if (confirm(`Converter "${l.name}" em cliente?`)) convert.mutate(l); }}><UserPlus className="h-4 w-4" /></Button>
                      {l.archived ? (
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Restaurar ao pipeline" onClick={() => archive.mutate({ id: l.id, archived: false })}><ArchiveRestore className="h-4 w-4" /></Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Retirar do pipeline" onClick={() => { if (confirm("Retirar este lead do pipeline? Continuará visível apenas na lista.")) archive.mutate({ id: l.id, archived: true }); }}><Archive className="h-4 w-4" /></Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm("Remover este lead?")) del.mutate(l.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {leads.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum lead cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Lead" : "Novo Lead"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Origem</Label><Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Instagram, Site, Indicação…" /></div>
            <div><Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{cols.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            {form.status === "perdido" && (
              <div>
                <Label>Motivo da perda</Label>
                <Input
                  value={form.lost_reason}
                  onChange={(e) => setForm({ ...form, lost_reason: e.target.value })}
                  placeholder="Descreva o motivo da perda"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={!form.name}>{editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Lead"
        record={viewing}
        fields={[
          { key: "code", label: "Código" }, { key: "name", label: "Nome" },
          { key: "email", label: "Email" }, { key: "phone", label: "Telefone" },
          { key: "origin", label: "Origem" },
          { key: "status", label: "Estado", format: (v) => cols.find((c) => c.key === v)?.label ?? v },
          { key: "lost_reason", label: "Motivo da perda" },
          { key: "archived", label: "Arquivado", format: (v) => v ? "Sim" : "Não" },
          { key: "notes", label: "Notas" },
        ]}
      />
    </div>
  );
}
