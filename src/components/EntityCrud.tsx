import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import { QuickViewDialog } from "@/components/QuickViewDialog";

export type FieldType = "text" | "number" | "date" | "email" | "phone" | "checkbox" | "textarea" | "select";
export interface CrudField {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  step?: string;
  options?: { value: string; label: string }[];
  /** Carrega as opções do select a partir de uma tabela do Supabase */
  optionsFrom?: { table: string; value?: string; label?: string; orderBy?: string };
}


const EXPIRY_META: Record<string, { primaryKey: string; entityLabel: string; category: string }> = {
  drivers:   { primaryKey: "full_name", entityLabel: "Motorista",   category: "licenca" },
  vehicles:  { primaryKey: "plate",     entityLabel: "Veículo",     category: "veiculo" },
  employees: { primaryKey: "full_name", entityLabel: "Funcionário", category: "documento" },
};

async function autoCreateExpiryAlerts(table: string, row: any, fields: CrudField[]) {
  const meta = EXPIRY_META[table];
  if (!meta || !row) return;
  const primary = row[meta.primaryKey] ?? "";
  const docs = fields
    .filter((f) => f.type === "date" && /_expiry$/.test(f.key) && row[f.key])
    .map((f) => ({
      title: `${f.label} · ${primary}`.trim(),
      category: meta.category,
      entity: `${meta.entityLabel}: ${primary}`,
      due_date: row[f.key],
      reminder_days: 30,
      status: "ativo",
      currency: "EUR",
      notes: `Auto-gerado ao cadastrar ${meta.entityLabel.toLowerCase()}.`,
    }));
  if (docs.length === 0) return;
  await supabase.from("company_documents").insert(docs);
}

interface Props {
  table: string;
  title: string;
  fields: CrudField[];
  columns?: string[];        // colunas visíveis (subset de field.key)
  orderBy?: string;
  /** Botões extra ao lado de "Novo" */
  extraActions?: ReactNode;
}

export function EntityCrud({ table, title, fields, columns, orderBy = "created_at", extraActions }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");
  const cols = columns ?? fields.slice(0, 4).map((f) => f.key);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [table, "list"],
    queryFn: async () => (await supabase.from(table as any).select("*").order(orderBy, { ascending: false })).data ?? [],
  });

  // Opções dinâmicas (ex.: regiões)
  const remoteFields = fields.filter((f) => f.optionsFrom);
  const { data: remoteOptions = {} } = useQuery({
    queryKey: ["crud-remote-options", table, remoteFields.map((f) => f.optionsFrom!.table).join(",")],
    enabled: remoteFields.length > 0,
    queryFn: async () => {
      const out: Record<string, { value: string; label: string }[]> = {};
      for (const f of remoteFields) {
        const cfg = f.optionsFrom!;
        const valueKey = cfg.value ?? "id";
        const labelKey = cfg.label ?? "name";
        const { data } = await supabase.from(cfg.table as any).select("*").order(cfg.orderBy ?? labelKey);
        out[f.key] = (data ?? []).map((r: any) => ({ value: String(r[valueKey]), label: String(r[labelKey] ?? "") }));
      }
      return out;
    },
  });
  const optionsFor = (f: CrudField) => (f.optionsFrom ? (remoteOptions as any)[f.key] ?? [] : f.options ?? []);

  function renderCell(row: any, key: string) {
    const f = fields.find((x) => x.key === key);
    const v = row[key];
    if (typeof v === "boolean") return v ? "Sim" : "Não";
    if (f?.type === "select") return optionsFor(f).find((o: any) => o.value === String(v))?.label ?? (v ?? "—");
    return v ?? "—";
  }



  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {};
      for (const f of fields) {
        let v = form[f.key];
        if (v === "" || v === undefined) v = null;
        if (f.type === "number" && v !== null) v = Number(v);
        payload[f.key] = v;
      }
      if (editing?.id) {
        const { error } = await supabase.from(table as any).update(payload as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from(table as any).insert(payload as any).select().single();
        if (error) throw error;
        // Auto-gerar alertas de vencimento para veículos / motoristas / funcionários
        await autoCreateExpiryAlerts(table, inserted, fields);
      }
    },
    onSuccess: () => {
      toast.success("Guardado");
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["company_documents"] });
      setOpen(false); setEditing(null); setForm({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: [table] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setForm({}); setOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm(row); setOpen(true); }

  const term = search.trim().toLowerCase();
  const filteredRows = term
    ? (rows as any[]).filter((r) =>
        cols.some((c) => String(renderCell(r, c) ?? "").toLowerCase().includes(term)) ||
        fields.some((f) => String(r[f.key] ?? "").toLowerCase().includes(term)),
      )
    : (rows as any[]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar…"
              className="pl-8"
            />
          </div>
          {extraActions}
          <Button onClick={openNew} className="gradient-gold text-gold-foreground">
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>

      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => <TableHead key={c}>{fields.find((f) => f.key === c)?.label ?? c}</TableHead>)}
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={cols.length + 1} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>}
            {!isLoading && filteredRows.length === 0 && <TableRow><TableCell colSpan={cols.length + 1} className="text-center text-muted-foreground py-8">{term ? "Sem resultados para o filtro." : "Sem registos."}</TableCell></TableRow>}
            {filteredRows.map((r: any) => (
              <TableRow key={r.id}>
                {cols.map((c) => (
                  <TableCell key={c}>
                    {renderCell(r, c)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(r)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} · {title}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                {f.type === "checkbox" ? (
                  <div className="flex items-center h-9">
                    <Checkbox checked={!!form[f.key]} onCheckedChange={(v) => setForm({ ...form, [f.key]: !!v })} />
                  </div>
                ) : f.type === "select" ? (
                  <Select value={form[f.key] ?? ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {optionsFor(f).map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : f.type === "textarea" ? (
                  <textarea className="w-full min-h-20 rounded-md border border-input bg-background p-2 text-sm"
                    value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
                    step={f.step}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} className="gradient-gold text-gold-foreground" disabled={save.isPending}>
              {editing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={title}
        record={viewing}
        fields={fields.map((f) => ({ key: f.key, label: f.label }))}
      />
    </div>
  );
}
