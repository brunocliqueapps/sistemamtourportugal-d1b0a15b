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
import { Plus, Pencil, Trash2, History, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { PhoneCountrySelect } from "@/components/PhoneCountrySelect";
import { useNextClientNumber } from "@/lib/next-client-number";


export const Route = createFileRoute("/clientes")({ component: Clientes });

const ORIGINS = ["Instagram", "Facebook", "Site", "Indicação", "Parcerias", "Outro"];




const emptyClient = {
  name: "", nif: "", email: "", phone: "", phone_country: "+351", origin: "",
  birth_date: "", emergency_contact: "", city: "", country: "", address: "", notes: "",
  arrival_date: "", arrival_time: "", arrival_place: "",
  departure_date: "", departure_time: "", departure_place: "", passengers: "",
};

function Clientes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyClient);
  const [search, setSearch] = useState("");
  const [historyClient, setHistoryClient] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);

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
      setOpen(false); setEditing(null); setForm(emptyClient);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
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
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.nif?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4">
      <PageHeader title="Clientes" description="Clientes registados manualmente ou convertidos de leads." />

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Procurar por nome, NIF ou email" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyClient); setOpen(true); }} className="gradient-gold text-gold-foreground">
          <Plus className="h-4 w-4 mr-1" /> Novo cliente
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº Cliente</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>NIF / Passaporte</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="w-40 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem clientes.</TableCell></TableRow>}
            {filtered.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.client_number ?? "—"}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.nif ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{[c.phone_country, c.phone].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell>{c.origin ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(c)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Histórico de serviços" onClick={() => setHistoryClient(c)}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setForm({ ...emptyClient, ...c }); setOpen(true); }}>
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
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {editing?.client_number ? (
              <div className="text-xs text-muted-foreground">
                Nº de cliente: <span className="font-mono font-semibold">{editing.client_number}</span> (fixo — todos os serviços começam por este número)
              </div>
            ) : nextNumber ? (
              <div className="text-xs text-muted-foreground">
                Nº de cliente a atribuir: <span className="font-mono font-semibold text-foreground">{nextNumber}</span>
              </div>
            ) : null}


            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Dados do cliente</h4>
              <div><Label>Nome *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
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
                <div><Label>NIF / Passaporte</Label><Input value={form.nif ?? ""} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></div>
                <div><Label>Data de nascimento</Label><Input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
              </div>
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
                <div><Label>Contacto de emergência</Label><Input value={form.emergency_contact ?? ""} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Nome e telefone" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Cidade</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>País</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                <div><Label>Morada</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Passageiros</Label><Input type="number" min={0} value={form.passengers ?? ""} onChange={(e) => setForm({ ...form, passengers: e.target.value })} /></div>
              </div>
            </div>

            <div className="border-t pt-3">
              <Label>Notas</Label>
              <textarea className="w-full min-h-20 rounded-md border border-input bg-background p-2 text-sm"
                value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
          { key: "client_number", label: "Nº Cliente" },
          { key: "name", label: "Nome" }, { key: "nif", label: "NIF / Passaporte" },
          { key: "email", label: "Email" }, { key: "phone_country", label: "Indicativo" },
          { key: "phone", label: "Telefone" }, { key: "origin", label: "Origem" },
          { key: "birth_date", label: "Data de nascimento" },
          { key: "emergency_contact", label: "Contacto de emergência" },
          { key: "city", label: "Cidade" }, { key: "country", label: "País" },
          { key: "address", label: "Morada" },
          { key: "arrival_date", label: "Data de chegada" }, { key: "arrival_time", label: "Hora de chegada" },
          { key: "arrival_place", label: "Local de chegada" },
          { key: "departure_date", label: "Data de partida" }, { key: "departure_time", label: "Hora de partida" },
          { key: "departure_place", label: "Local de partida" },
          { key: "passengers", label: "Passageiros" },
          { key: "notes", label: "Notas" },
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
    queryFn: async () => (await supabase.from("proposals").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["client-history", "orders", clientId],
    enabled,
    queryFn: async () => (await supabase.from("service_orders").select("*, drivers(full_name), vehicles(plate)").eq("client_id", clientId).order("service_date", { ascending: false })).data ?? [],
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["client-history", "invoices", clientId],
    enabled,
    queryFn: async () => (await supabase.from("invoices").select("*").eq("client_id", clientId).order("issue_date", { ascending: false })).data ?? [],
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
                  <TableHead>Data</TableHead><TableHead>OC</TableHead><TableHead>Voucher</TableHead>
                  <TableHead>Motorista</TableHead><TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Valor</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {orders.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem serviços.</TableCell></TableRow>}
                  {orders.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell>{dt(o.service_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{o.oc_code ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{o.voucher_code ?? "—"}</TableCell>
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
