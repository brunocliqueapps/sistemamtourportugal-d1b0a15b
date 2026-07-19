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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, History, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { QuickViewDialog } from "@/components/QuickViewDialog";

export const Route = createFileRoute("/clientes")({ component: Clientes });

const emptyClient = { name: "", nif: "", email: "", phone: "", city: "", country: "", address: "", notes: "" };

function Clientes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyClient);
  const [search, setSearch] = useState("");
  const [historyClient, setHistoryClient] = useState<any | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", "list"],
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
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
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = clients.filter((c: any) => {
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.nif?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 md:p-8 space-y-4">
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
              <TableHead>Nome</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead className="w-40 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem clientes.</TableCell></TableRow>}
            {filtered.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.nif ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>{c.city ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" title="Histórico" onClick={() => setHistoryClient(c)}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setForm({ ...emptyClient, ...c }); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover cliente?")) del.mutate(c.id); }}>
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
          <div className="grid grid-cols-2 gap-3">
            {[
              ["name", "Nome *"], ["nif", "NIF"], ["email", "Email"], ["phone", "Telefone"],
              ["city", "Cidade"], ["country", "País"], ["address", "Morada"],
            ].map(([k, l]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <div className="col-span-2">
              <Label>Notas</Label>
              <textarea className="w-full min-h-20 rounded-md border border-input bg-background p-2 text-sm"
                value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} className="gradient-gold text-gold-foreground" disabled={save.isPending}>
              {editing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientHistoryDialog client={historyClient} onClose={() => setHistoryClient(null)} />
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
