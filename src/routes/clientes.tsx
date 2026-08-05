import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, History, Search, Eye, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { shortCode } from "@/lib/codes";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { PhoneCountrySelect } from "@/components/PhoneCountrySelect";
import { useNextClientNumber } from "@/lib/next-client-number";
import { daysBetween } from "@/lib/payment-terms";
import { fmtDate } from "@/lib/format-date";
import { useUnsavedChanges } from "@/lib/unsaved-changes-context";



export const Route = createFileRoute("/clientes")({ component: Clientes });

const ORIGINS = ["Instagram", "Facebook", "Site", "Indicação", "Parcerias", "Outro"];
const ORIGINS_WITH_DETAIL = ["Indicação", "Parcerias", "Outro"];

const cols: { key: string; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "em_negociacao", label: "Em negociação" },
  { key: "fechado", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
];

const TEMPS: { key: string; label: string; cls: string }[] = [
  { key: "novo", label: "Novo Lead", cls: "bg-gold/15 text-gold border-gold/30" },
  { key: "frio", label: "Frio", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30" },
  { key: "morno", label: "Morno", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
  { key: "quente", label: "Quente", cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30" },
];

const emptyClient = {
  name: "", passengers: "", email: "", phone: "", phone_country: "+351",
  nif: "", birth_date: "", emergency_contact: "",
  origin: "", origin_detail: "", temperature: "novo", status: "novo",
  city: "", country: "", address: "", notes: "", lost_reason: "",
  arrival_date: "", arrival_time: "", arrival_place: "",
  departure_date: "", departure_time: "", departure_place: "",
};


function Clientes() {
  const qc = useQueryClient();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [open, setOpen] = useState(false);

  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyClient);
  const [search, setSearch] = useState("");
  const [historyClient, setHistoryClient] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [showArchivedList, setShowArchivedList] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const nextNumber = useNextClientNumber();


  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", "list"],
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      delete payload.client_number; // número de cliente é fixo
      delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.lead_id;
      payload.passengers = payload.passengers === "" || payload.passengers == null ? null : Number(payload.passengers);
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      if (editing?.id) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Guardado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["next-client-number"] });

      setOpen(false); setEditing(null); setForm(emptyClient); setHasUnsavedChanges(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("clients" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("clients" as any).update({ archived } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.archived ? "Cliente arquivado (fora do pipeline)" : "Cliente restaurado ao pipeline");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e: any) => {
      if (e?.code === "23503" || /foreign key/i.test(e?.message ?? "")) {
        toast.error("Este cliente tem propostas/serviços associados. Aplique a migração supabase-migration-v14-delete-cascade.sql para permitir a remoção em cascata.");
        return;
      }
      toast.error(e.message);
    },
  });


  const filtered = clients.filter((c: any) => {
    if (showArchivedList && !c.archived) return false;
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.nif?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4">
      <PageHeader title="Clientes" description="Pipeline comercial e ficha completa de cada cliente." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map((col) => (
          <Card
            key={col.key}
            className={`p-4 transition-colors ${dragOverCol === col.key ? "ring-2 ring-primary/60 bg-primary/5" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
            onDragLeave={() => setDragOverCol((prev) => (prev === col.key ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              setDragOverCol(null); setDragId(null);
              if (!id) return;
              const c: any = clients.find((x: any) => x.id === id);
              if (!c || (c.status ?? "novo") === col.key) return;
              update.mutate({ id, patch: { status: col.key } });
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{col.label}</h3>
              <Badge variant="secondary">{clients.filter((c: any) => (c.status ?? "novo") === col.key && !c.archived).length}</Badge>
            </div>
            <div className="space-y-2 min-h-16">
              {clients.filter((c: any) => (c.status ?? "novo") === col.key && !c.archived).map((c: any) => (
                <Card
                  key={c.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; setDragId(c.id); }}
                  onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                  className={`p-3 cursor-grab active:cursor-grabbing cursor-gold-hand ${dragId === c.id ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-muted-foreground">{shortCode(c.client_number)}</div>
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.passengers ? `${c.passengers} pax` : "Sem nº de pessoas"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[fmtDate(c.arrival_date), fmtDate(c.departure_date)].filter(Boolean).join(" → ") || "Sem datas"}
                      </div>
                      <Badge variant="outline" className={`mt-1 text-[10px] ${TEMPS.find((t) => t.key === (c.temperature ?? "novo"))?.cls ?? ""}`}>
                        {TEMPS.find((t) => t.key === (c.temperature ?? "novo"))?.label ?? c.temperature}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Visualizar" onClick={() => setViewing(c)}><Eye className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Histórico" onClick={() => setHistoryClient(c)}><History className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Arquivar (retirar do pipeline)" onClick={() => { if (confirm("Retirar este cliente do pipeline? Continuará visível na lista.")) archive.mutate({ id: c.id, archived: true }); }}><Archive className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditing(c); setForm({ ...emptyClient, ...c }); setOpen(true); setHasUnsavedChanges(false); }}><Pencil className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <Select value={c.status ?? "novo"} onValueChange={(v) => update.mutate({ id: c.id, patch: { status: v } })}>
                    <SelectTrigger className="h-7 text-xs mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>{cols.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {(c.status ?? "novo") === "perdido" && (
                    <Input placeholder="Motivo da perda" defaultValue={c.lost_reason ?? ""}
                      onBlur={(e) => update.mutate({ id: c.id, patch: { lost_reason: e.target.value } })}
                      className="h-7 text-xs mt-2" />
                  )}
                </Card>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Procurar por nome, NIF ou email" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showArchivedList} onCheckedChange={setShowArchivedList} />
            Mostrar apenas arquivados
          </label>
          <Button onClick={() => { setEditing(null); setForm(emptyClient); setOpen(true); setHasUnsavedChanges(false); }} className="gradient-gold text-gold-foreground">
            <Plus className="h-4 w-4 mr-1" /> Novo cliente
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Número de Pessoas</TableHead>
              <TableHead>Data da Chegada</TableHead>
              <TableHead>Data da Partida</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead className="w-44 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem clientes.</TableCell></TableRow>}
            {filtered.map((c: any) => (
              <TableRow key={c.id} className={c.archived ? "opacity-60" : ""}>
                <TableCell className="font-medium">
                  {c.name}
                  {c.archived && <Badge variant="secondary" className="ml-2">Arquivado</Badge>}
                </TableCell>
                <TableCell>{c.passengers ?? "—"}</TableCell>
                <TableCell>{fmtDate(c.arrival_date) || "—"}</TableCell>
                <TableCell>{fmtDate(c.departure_date) || "—"}</TableCell>
                <TableCell>{daysBetween(c.arrival_date, c.departure_date) || "—"}</TableCell>

                <TableCell className="text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(c)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Histórico de serviços" onClick={() => setHistoryClient(c)}>
                    <History className="h-4 w-4" />
                  </Button>
                  {c.archived ? (
                    <Button size="icon" variant="ghost" title="Restaurar ao pipeline" onClick={() => archive.mutate({ id: c.id, archived: false })}>
                      <ArchiveRestore className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" title="Arquivar" onClick={() => { if (confirm("Retirar este cliente do pipeline? Continuará visível na lista.")) archive.mutate({ id: c.id, archived: true }); }}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setForm({ ...emptyClient, ...c }); setOpen(true); setHasUnsavedChanges(false); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover cliente? Propostas, serviços e faturas associados também serão removidos.")) del.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(v) => {
        if (!v && hasUnsavedChanges) {
          if (!confirm("Tem alterações não guardadas. Deseja sair?")) return;
        }
        setOpen(v);
        if (!v) setHasUnsavedChanges(false);
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {editing?.client_number ? (
              <div className="text-xs text-muted-foreground">
                Nº de cliente: <span className="font-mono font-semibold">{shortCode(editing.client_number)}</span> (fixo — todos os serviços começam por este número)
              </div>
            ) : nextNumber ? (
              <div className="text-xs text-muted-foreground">
                Nº de cliente a atribuir: <span className="font-mono font-semibold text-foreground">{nextNumber}</span>
              </div>
            ) : null}


            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Dados do cliente</h4>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_10rem] gap-3">
                <div><Label>Nome *</Label><Input value={form.name ?? ""} onChange={(e) => { setForm({ ...form, name: e.target.value }); setHasUnsavedChanges(true); }} /></div>
                <div><Label>Número de pessoas</Label><Input type="number" min={0} value={form.passengers ?? ""} onChange={(e) => { setForm({ ...form, passengers: e.target.value }); setHasUnsavedChanges(true); }} /></div>
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Dados da viagem</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Data de chegada</Label><Input type="date" value={form.arrival_date ?? ""} onChange={(e) => setForm({ ...form, arrival_date: e.target.value })} /></div>
                <div><Label>Hora de chegada</Label><Input type="time" value={form.arrival_time ?? ""} onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} /></div>
                <div><Label>Local de chegada</Label><Input value={form.arrival_place ?? ""} onChange={(e) => setForm({ ...form, arrival_place: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Data de partida</Label><Input type="date" value={form.departure_date ?? ""} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} /></div>
                <div><Label>Hora de partida</Label><Input type="time" value={form.departure_time ?? ""} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} /></div>
                <div><Label>Local de partida</Label><Input value={form.departure_place ?? ""} onChange={(e) => setForm({ ...form, departure_place: e.target.value })} /></div>
              </div>
              <div className="text-xs text-muted-foreground">
                Dias de viagem: <span className="font-semibold text-foreground">{daysBetween(form.arrival_date, form.departure_date) || 0}</span>
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Contactos e documentos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div>
                  <Label>Telefone</Label>
                  <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                    <PhoneCountrySelect value={form.phone_country} onChange={(v) => setForm({ ...form, phone_country: v })} />

                    <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="912 345 678" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Passaporte</Label><Input value={form.nif ?? ""} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></div>
                <div><Label>Data de nascimento</Label><Input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
              </div>
              <div><Label>Contacto de emergência</Label><Input value={form.emergency_contact ?? ""} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Nome e telefone" /></div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Origem do Lead</Label>
                  <Select value={form.origin || ""} onValueChange={(v) => setForm({ ...form, origin: v, origin_detail: ORIGINS_WITH_DETAIL.includes(v) ? form.origin_detail : "" })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                    <SelectContent className="max-h-56 overflow-y-auto">
                      {ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status do Lead (temperatura)</Label>
                  <Select value={form.temperature || "novo"} onValueChange={(v) => setForm({ ...form, temperature: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TEMPS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {ORIGINS_WITH_DETAIL.includes(form.origin) && (
                <div>
                  <Label>Descrever origem ({form.origin})</Label>
                  <Input value={form.origin_detail ?? ""} onChange={(e) => setForm({ ...form, origin_detail: e.target.value })} placeholder="Quem indicou / qual parceria / detalhe" />
                </div>
              )}
              <div>
                <Label>Estado</Label>
                <Select value={form.status || "novo"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{cols.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.status === "perdido" && (
                <div><Label>Motivo da perda</Label><Input value={form.lost_reason ?? ""} onChange={(e) => setForm({ ...form, lost_reason: e.target.value })} /></div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Cidade</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>País</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                <div><Label>Morada</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              </div>
              <div>
                <Label>Notas</Label>
                <textarea className="w-full min-h-20 rounded-md border border-input bg-background p-2 text-sm"
                  value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} className="gradient-gold text-gold-foreground" disabled={save.isPending || !form.name}>
              {editing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientHistoryDialog client={historyClient} onClose={() => setHistoryClient(null)} />

      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Cliente"
        record={viewing}
        fields={[
          { key: "client_number", label: "Nº Cliente", format: (v: any) => shortCode(v) },
          { key: "name", label: "Nome" },
          { key: "passengers", label: "Número de pessoas" },
          { key: "arrival_date", label: "Data de chegada", format: (v: any) => fmtDate(v) || "—" },
          { key: "arrival_time", label: "Hora de chegada" },
          { key: "arrival_place", label: "Local de chegada" },
          { key: "departure_date", label: "Data de partida", format: (v: any) => fmtDate(v) || "—" },
          { key: "departure_time", label: "Hora de partida" },
          { key: "departure_place", label: "Local de partida" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Telefone", format: (v, r: any) => v ? `${r?.phone_country ?? ""} ${v}`.trim() : "—" },
          { key: "nif", label: "Passaporte" },
          { key: "birth_date", label: "Data de nascimento" },
          { key: "emergency_contact", label: "Contacto de emergência" },
          { key: "origin", label: "Origem do Lead", format: (v, r: any) => [v, r?.origin_detail].filter(Boolean).join(" · ") || "—" },
          { key: "temperature", label: "Status do Lead", format: (v: any) => TEMPS.find((t) => t.key === v)?.label ?? v ?? "—" },
          { key: "status", label: "Estado", format: (v: any) => cols.find((c) => c.key === v)?.label ?? v ?? "—" },
          { key: "city", label: "Cidade" }, { key: "country", label: "País" },
          { key: "address", label: "Morada" },
          { key: "notes", label: "Notas" },
          { key: "lost_reason", label: "Motivo da perda" },
          { key: "archived", label: "Arquivado", format: (v: any) => v ? "Sim" : "Não" },

        ]}
      />
    </div>
  );
}


function ClientHistoryDialog({ client, onClose }: { client: any | null; onClose: () => void }) {
  const enabled = !!client?.id;
  const clientId = client?.id;

  const { data: proposals = [] } = useQuery({
    queryKey: ["client-history", "proposals", clientId],
    enabled,
    queryFn: async () => (await supabase.from("proposals" as any).select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["client-history", "orders", clientId],
    enabled,
    queryFn: async () => (await supabase.from("service_orders" as any).select("*, drivers(full_name), vehicles(plate)").eq("client_id", clientId).order("service_date", { ascending: false })).data ?? [],
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["client-history", "invoices", clientId],
    enabled,
    queryFn: async () => (await supabase.from("invoices" as any).select("*").eq("client_id", clientId).order("issue_date", { ascending: false })).data ?? [],
  });

  const totalServices = orders.length;
  const totalBilled = invoices.filter((i: any) => i.kind === "entrada").reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
  const totalPaid = invoices.filter((i: any) => i.kind === "entrada" && i.status === "paga").reduce((s: number, i: any) => s + Number(i.paid_amount ?? i.total ?? 0), 0);
  const totalPending = totalBilled - totalPaid;

  const fmt = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
  const dt = (d?: string) => d ? new Date(d).toLocaleDateString("pt-PT") : "—";

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico · {client?.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">{client?.nif && `NIF ${client.nif} · `}{client?.email} {client?.phone && `· ${client.phone}`}</p>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Propostas</div><div className="text-2xl font-semibold">{proposals.length}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Serviços</div><div className="text-2xl font-semibold">{totalServices}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Faturado</div><div className="text-2xl font-semibold">{fmt(totalBilled)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Em aberto</div><div className="text-2xl font-semibold text-destructive">{fmt(totalPending)}</div></Card>
        </div>

        <Tabs defaultValue="services">
          <TabsList>
            <TabsTrigger value="services">Serviços ({orders.length})</TabsTrigger>
            <TabsTrigger value="proposals">Propostas ({proposals.length})</TabsTrigger>
            <TabsTrigger value="invoices">Faturas ({invoices.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>OS</TableHead><TableHead>Voucher</TableHead>
                  <TableHead>Motorista</TableHead><TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Valor</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {orders.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem serviços.</TableCell></TableRow>}
                  {orders.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell>{dt(o.service_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{shortCode(o.oc_code)}</TableCell>
                      <TableCell className="font-mono text-xs">{shortCode(o.voucher_code)}</TableCell>
                      <TableCell>{o.drivers?.full_name ?? "—"}</TableCell>
                      <TableCell>{o.vehicles?.plate ?? "—"}</TableCell>
                      <TableCell>{o.operation_type ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{o.status ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(Number(o.sale_value ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="proposals">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Título</TableHead><TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead><TableHead className="text-right">Valor</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {proposals.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem propostas.</TableCell></TableRow>}
                  {proposals.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{dt(p.created_at)}</TableCell>
                      <TableCell>{p.title ?? "—"}</TableCell>
                      <TableCell>{p.proposal_type ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{p.status ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(Number(p.total_value ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Emissão</TableHead><TableHead>Nº</TableHead><TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {invoices.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem faturas.</TableCell></TableRow>}
                  {invoices.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell>{dt(i.issue_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{i.invoice_number ?? i.code ?? "—"}</TableCell>
                      <TableCell>{i.kind}</TableCell>
                      <TableCell className="max-w-xs truncate">{i.description ?? "—"}</TableCell>
                      <TableCell><Badge variant={i.status === "paga" ? "default" : "outline"}>{i.status ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(Number(i.total ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
