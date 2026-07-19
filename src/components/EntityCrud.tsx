import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { QuickViewDialog } from "@/components/QuickViewDialog";

export type FieldType = "text" | "number" | "date" | "email" | "phone" | "checkbox" | "textarea";
export interface CrudField {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  step?: string;
}

interface Props {
  table: string;
  title: string;
  fields: CrudField[];
  columns?: string[];        // colunas visíveis (subset de field.key)
  orderBy?: string;
}

export function EntityCrud({ table, title, fields, columns, orderBy = "created_at" }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const cols = columns ?? fields.slice(0, 4).map((f) => f.key);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [table, "list"],
    queryFn: async () => (await supabase.from(table).select("*").order(orderBy, { ascending: false })).data ?? [],
  });

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
        const { error } = await supabase.from(table).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Guardado");
      qc.invalidateQueries({ queryKey: [table] });
      setOpen(false); setEditing(null); setForm({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: [table] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setForm({}); setOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm(row); setOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button onClick={openNew} className="gradient-gold text-gold-foreground">
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
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
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={cols.length + 1} className="text-center text-muted-foreground py-8">Sem registos.</TableCell></TableRow>}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                {cols.map((c) => (
                  <TableCell key={c}>
                    {typeof r[c] === "boolean" ? (r[c] ? "Sim" : "Não") : (r[c] ?? "—")}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} · {title}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "col-span-2" : ""}>
                <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                {f.type === "checkbox" ? (
                  <div className="flex items-center h-9">
                    <Checkbox checked={!!form[f.key]} onCheckedChange={(v) => setForm({ ...form, [f.key]: !!v })} />
                  </div>
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
