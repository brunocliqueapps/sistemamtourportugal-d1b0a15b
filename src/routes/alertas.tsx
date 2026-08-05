import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/alertas")({ component: Alertas });

const CATEGORIAS = [
  "seguro", "licenca", "taxa", "imposto", "alvara", "certidao",
  "contrato", "documento", "veiculo", "outro",
];
const STATUS = ["ativo", "pago", "renovado", "expirado", "cancelado"];

type Doc = {
  id: string;
  title: string;
  category: string;
  entity: string | null;
  document_number: string | null;
  issuer: string | null;
  amount: number | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string;
  reminder_days: number;
  status: string;
  responsible: string | null;
  attachment_url: string | null;
  notes: string | null;
};

const EMPTY: Partial<Doc> = {
  title: "", category: "documento", status: "ativo", reminder_days: 30, currency: "EUR",
};

function daysUntil(due: string) {
  const d = new Date(due + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function ExpiryBadge({ due, reminder, status }: { due: string; reminder: number; status: string }) {
  if (status === "pago" || status === "renovado" || status === "cancelado") {
    return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
  const d = daysUntil(due);
  if (d < 0) return <Badge variant="destructive">Expirado há {Math.abs(d)}d</Badge>;
  if (d === 0) return <Badge variant="destructive">Vence hoje</Badge>;
  if (d <= reminder) return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Faltam {d}d</Badge>;
  return <Badge variant="secondary">Faltam {d}d</Badge>;
}

function Alertas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [form, setForm] = useState<Partial<Doc>>(EMPTY);
  const [catFilter, setCatFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["company_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_documents" as any)
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (payload.amount === "" || payload.amount === undefined) payload.amount = null;
      else payload.amount = Number(payload.amount);
      payload.reminder_days = Number(payload.reminder_days ?? 30);
      for (const k of ["entity", "document_number", "issuer", "issue_date", "responsible", "attachment_url", "notes"]) {
        if (payload[k] === "" || payload[k] === undefined) payload[k] = null;
      }
      if (editing?.id) {
        const { error } = await supabase.from("company_documents" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_documents" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Guardado");
      qc.invalidateQueries({ queryKey: ["company_documents"] });
      setOpen(false); setEditing(null); setForm(EMPTY);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["company_documents"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => rows.filter((r) =>
    (catFilter === "todos" || r.category === catFilter) &&
    (statusFilter === "todos" || r.status === statusFilter)
  ), [rows, catFilter, statusFilter]);

  const kpis = useMemo(() => {
    let vencidos = 0, urgentes = 0, ok = 0, total = rows.length;
    for (const r of rows) {
      if (["pago", "renovado", "cancelado"].includes(r.status)) { ok++; continue; }
      const d = daysUntil(r.due_date);
      if (d < 0) vencidos++;
      else if (d <= (r.reminder_days ?? 30)) urgentes++;
      else ok++;
    }
    return { vencidos, urgentes, ok, total };
  }, [rows]);

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: Doc) { setEditing(r); setForm(r); setOpen(true); }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title="Alertas de Documentos e Vencimentos"
        description="Controlo de seguros, taxas, licenças e documentos da empresa."
      />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total" value={kpis.total} icon={Bell} tone="text-primary" />
        <Kpi label="Vencidos" value={kpis.vencidos} icon={AlertTriangle} tone="text-destructive" />
        <Kpi label="A vencer" value={kpis.urgentes} icon={Clock} tone="text-amber-500" />
        <Kpi label="Em dia" value={kpis.ok} icon={CheckCircle2} tone="text-emerald-500" />
      </div>

      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label>Categoria</Label>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {CATEGORIAS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label>Estado</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button onClick={openNew} className="gradient-gold text-gold-foreground">
            <Plus className="h-4 w-4 mr-1" /> Novo registo
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Nº doc.</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Alerta</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">A carregar…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem registos.</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="capitalize">{r.category}</TableCell>
                <TableCell>{r.entity ?? "—"}</TableCell>
                <TableCell>{r.document_number ?? "—"}</TableCell>
                <TableCell>{new Date(r.due_date + "T00:00:00").toLocaleDateString("pt-PT")}</TableCell>
                <TableCell><ExpiryBadge due={r.due_date} reminder={r.reminder_days} status={r.status} /></TableCell>
                <TableCell className="text-right">
                  {r.amount != null ? `${Number(r.amount).toFixed(2)} ${r.currency ?? "EUR"}` : "—"}
                </TableCell>
                <TableCell className="capitalize">{r.status}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este registo?")) del.mutate(r.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} · Documento / Vencimento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Título *</Label>
              <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category ?? "documento"} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status ?? "ativo"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entidade</Label>
              <Input value={form.entity ?? ""} onChange={(e) => setForm({ ...form, entity: e.target.value })} placeholder="Empresa, Frota, fornecedor…" />
            </div>
            <div>
              <Label>Emissor</Label>
              <Input value={form.issuer ?? ""} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
            </div>
            <div>
              <Label>Nº do documento</Label>
              <Input value={form.document_number ?? ""} onChange={(e) => setForm({ ...form, document_number: e.target.value })} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsible ?? ""} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
            </div>
            <div>
              <Label>Data de emissão</Label>
              <Input type="date" value={form.issue_date ?? ""} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
            </div>
            <div>
              <Label>Data de vencimento *</Label>
              <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <Label>Alertar (dias antes)</Label>
              <Input type="number" min={0} value={form.reminder_days ?? 30} onChange={(e) => setForm({ ...form, reminder_days: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value as any })} />
            </div>
            <div>
              <Label>Moeda</Label>
              <Input value={form.currency ?? "EUR"} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Link do ficheiro</Label>
              <Input value={form.attachment_url ?? ""} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <textarea
                className="w-full min-h-20 rounded-md border border-input bg-background p-2 text-sm"
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!form.title || !form.due_date) { toast.error("Título e data de vencimento são obrigatórios"); return; }
                save.mutate();
              }}
              className="gradient-gold text-gold-foreground"
              disabled={save.isPending}
            >
              {editing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <Icon className={`h-6 w-6 ${tone}`} />
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </Card>
  );
}
