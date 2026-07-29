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

const ORIGINS = ["Instagram", "Facebook", "Site", "Indicação", "Parcerias", "Outro"];

const TEMPS: { key: string; label: string; cls: string }[] = [
  { key: "frio", label: "Frio", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30" },
  { key: "morno", label: "Morno", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
  { key: "quente", label: "Quente", cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30" },
];

const PHONE_COUNTRIES = [
  { code: "+351", label: "🇵🇹 Portugal +351" },
  { code: "+55", label: "🇧🇷 Brasil +55" },
  { code: "+34", label: "🇪🇸 Espanha +34" },
  { code: "+33", label: "🇫🇷 França +33" },
  { code: "+44", label: "🇬🇧 Reino Unido +44" },
  { code: "+49", label: "🇩🇪 Alemanha +49" },
  { code: "+39", label: "🇮🇹 Itália +39" },
  { code: "+1", label: "🇺🇸 EUA/Canadá +1" },
  { code: "+41", label: "🇨🇭 Suíça +41" },
  { code: "+31", label: "🇳🇱 Países Baixos +31" },
  { code: "+353", label: "🇮🇪 Irlanda +353" },
  { code: "+352", label: "🇱🇺 Luxemburgo +352" },
  { code: "+244", label: "🇦🇴 Angola +244" },
  { code: "+238", label: "🇨🇻 Cabo Verde +238" },
  { code: "+258", label: "🇲🇿 Moçambique +258" },
];

const empty = {
  name: "", email: "", phone: "", phone_country: "+351", origin: "", status: "novo",
  notes: "", lost_reason: "", temperature: "frio", nif: "", birth_date: "",
  emergency_contact: "", arrival_date: "", arrival_time: "", arrival_place: "",
  departure_date: "", departure_time: "", departure_place: "", passengers: "",
};

const FORM_KEYS = Object.keys(empty);

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
      const payload: any = { ...form };
      for (const k of ["birth_date", "arrival_date", "arrival_time", "departure_date", "departure_time"]) {
        if (!payload[k]) payload[k] = null;
      }
      payload.passengers = payload.passengers === "" || payload.passengers == null ? null : Number(payload.passengers);
      if (editing?.id) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert(payload);
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
    const f: any = {};
    for (const k of FORM_KEYS) f[k] = l[k] ?? (empty as any)[k];
    setForm(f);
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
                      {l.phone && <div className="text-xs">{[l.phone_country, l.phone].filter(Boolean).join(" ")}</div>}
                      <Badge variant="outline" className={`mt-1 text-[10px] ${TEMPS.find((t) => t.key === (l.temperature ?? "frio"))?.cls ?? ""}`}>
                        {TEMPS.find((t) => t.key === (l.temperature ?? "frio"))?.label ?? l.temperature}
                      </Badge>
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
                <TableHead>Nº cliente</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Temperatura</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.filter((l: any) => showArchivedList ? l.archived : true).map((l: any) => (
                <TableRow key={l.id} className={l.archived ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-xs">{l.code}</TableCell>
                  <TableCell className="font-mono text-xs">{l.client_number ?? "—"}</TableCell>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-sm">{l.email}</TableCell>
                  <TableCell className="text-sm">{[l.phone_country, l.phone].filter(Boolean).join(" ")}</TableCell>
                  <TableCell className="text-sm">{l.origin}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={TEMPS.find((t) => t.key === (l.temperature ?? "frio"))?.cls}>
                      {TEMPS.find((t) => t.key === (l.temperature ?? "frio"))?.label ?? l.temperature}
                    </Badge>
                  </TableCell>
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
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhum lead cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar Lead" : "Novo Lead"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {editing?.client_number && (
              <div className="text-xs text-muted-foreground">Nº de cliente: <span className="font-mono">{editing.client_number}</span></div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Dados do lead</h4>
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div>
                  <Label>Telefone</Label>
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
                    <Select value={form.phone_country || "+351"} onValueChange={(v) => setForm({ ...form, phone_country: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {PHONE_COUNTRIES.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="912 345 678" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>NIF / Passaporte</Label><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></div>
                <div><Label>Data de nascimento</Label><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
              </div>
              <div><Label>Contacto de emergência</Label><Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Nome e telefone" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Origem</Label>
                  <Select value={form.origin || ""} onValueChange={(v) => setForm({ ...form, origin: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                    <SelectContent className="max-h-56 overflow-y-auto">
                      {ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Temperatura</Label>
                  <Select value={form.temperature || "frio"} onValueChange={(v) => setForm({ ...form, temperature: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TEMPS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{cols.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Dados da viagem</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Data de chegada</Label><Input type="date" value={form.arrival_date} onChange={(e) => setForm({ ...form, arrival_date: e.target.value })} /></div>
                <div><Label>Hora de chegada</Label><Input type="time" value={form.arrival_time} onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} /></div>
                <div><Label>Local de chegada</Label><Input value={form.arrival_place} onChange={(e) => setForm({ ...form, arrival_place: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Data de partida</Label><Input type="date" value={form.departure_date} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} /></div>
                <div><Label>Hora de partida</Label><Input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} /></div>
                <div><Label>Local de partida</Label><Input value={form.departure_place} onChange={(e) => setForm({ ...form, departure_place: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Passageiros</Label><Input type="number" min={0} value={form.passengers} onChange={(e) => setForm({ ...form, passengers: e.target.value })} /></div>
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
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
          { key: "code", label: "Código" }, { key: "client_number", label: "Nº de cliente" },
          { key: "name", label: "Nome" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Telefone", format: (v, r: any) => v ? `${r?.phone_country ?? ""} ${v}`.trim() : "—" },
          { key: "nif", label: "NIF / Passaporte" },
          { key: "birth_date", label: "Data de nascimento" },
          { key: "emergency_contact", label: "Contacto de emergência" },
          { key: "origin", label: "Origem" },
          { key: "temperature", label: "Temperatura", format: (v) => TEMPS.find((t) => t.key === v)?.label ?? v },
          { key: "status", label: "Estado", format: (v) => cols.find((c) => c.key === v)?.label ?? v },
          { key: "arrival_date", label: "Data de chegada" },
          { key: "arrival_time", label: "Hora de chegada" },
          { key: "arrival_place", label: "Local de chegada" },
          { key: "departure_date", label: "Data de partida" },
          { key: "departure_time", label: "Hora de partida" },
          { key: "departure_place", label: "Local de partida" },
          { key: "passengers", label: "Passageiros" },
          { key: "lost_reason", label: "Motivo da perda" },
          { key: "archived", label: "Arquivado", format: (v) => v ? "Sim" : "Não" },
          { key: "notes", label: "Notas" },
        ]}
      />
    </div>
  );
}
